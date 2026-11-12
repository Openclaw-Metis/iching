// 解讀步驟：左欄本卦與之卦兩張卡圖（5:7），卦畫以朱紅標出變爻；右欄是保存狀態、讀法說明、主讀經文與白話，
// 下方是輔讀與問事指引。保存失敗（blocked）時解讀照常顯示，主操作改為下載這次結果。

import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { touch as touchCardCache } from '../../app/cardCache.ts'
import { FLAGS } from '../../app/flags.ts'
import { FocusText, focusText, focusTitle } from '../../components/FocusText.tsx'
import { LineBuilder } from '../../components/LineBuilder.tsx'
import { LinePlain } from '../../components/LinePlain.tsx'
import { NoteEditor } from '../../components/NoteEditor.tsx'
import { rise } from '../../components/rise.ts'
import { SaveStatusPill, type SaveStatus } from '../../components/SaveStatusPill.tsx'
import { Scripture } from '../../components/Scripture.tsx'
import { cardAsset } from '../../data/cards.ts'
import type { Hexagram } from '../../data/hexagrams.ts'
import { keyOf } from '../../data/lines.ts'
import { FavoriteButton, QuoteButton, type QuoteRef } from '../collection/index.ts'
import { ERROR_MESSAGES, isAppError } from '../../lib/errors.ts'
import type { ReadingFocus } from '../../lib/reading.ts'
import type { Reading } from '../../storage/index.ts'
import { buildReading } from './buildReading.ts'
import { GuidancePanel } from './GuidancePanel.tsx'

// 納甲盤展開才載入，不計入占卜頁自身的程式包（規格「納甲六爻盤：模組」）
const NajiaPanel = lazy(() => import('../najia/index.ts').then(m => ({ default: m.NajiaPanel })))

// 納甲的程式包載不到（多半是網站更新後舊分頁還開著）或排盤出錯時，只讓這一區顯示錯誤，
// 不讓例外冒到路由層把整頁的經文解讀換掉。不自動重試，由使用者決定要不要重新整理
class NajiaBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error) { console.warn(`[NAJIA_FAILED] ${error.message}`) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert">
        <p className="note">納甲六爻盤載入失敗，上面的經文解讀不受影響。多半是網站剛更新，重新整理後再展開一次。</p>
        <button type="button" className="btn" onClick={() => location.reload()}>重新整理</button>
      </div>
    )
  }
}

function NajiaSection({ reading }: { reading: Reading }) {
  const [opened, setOpened] = useState(false)
  return (
    <details className="accordion" onToggle={e => { if (e.currentTarget.open) setOpened(true) }}>
      <summary>納甲六爻盤</summary>
      {opened && (
        <NajiaBoundary>
          <Suspense fallback={<p className="note">載入中</p>}>
            {/* 舊紀錄沒有起卦時刻與時差，退回建立時間與查看裝置的時區 */}
            <NajiaPanel lines={reading.lines} castAt={reading.castAt ?? reading.createdAt} offsetMinutes={reading.castAt ? reading.castOffsetMinutes : undefined} question={reading.question} />
          </Suspense>
        </NajiaBoundary>
      )}
    </details>
  )
}

interface Props {
  reading: Reading
  status: SaveStatus
  /** blocked 時保存失敗的原因 */
  error?: unknown
  onSaveNote: (text: string, rev?: number) => Promise<number | void>
  onAgain: () => void
  onDownload: () => void
  onRetry: () => void
}

function Card({ hex, label }: { hex: Hexagram; label: string }) {
  return (
    <div className="result-card-wrap">
      <Link to={`/gua/${hex.number}`} className="result-card">
        <img src={cardAsset(hex.number, 'thumb')} alt={`${label}：${hex.fullName}`} width={400} height={560} />
        <span>{label}・{hex.name}</span>
      </Link>
      {FLAGS.collection && <FavoriteButton hexagram={hex.number} label={`${hex.name}卦`} />}
    </div>
  )
}

const quoteOf = (f: ReadingFocus): QuoteRef =>
  f.kind === 'line' ? { hexagram: f.hexagram.number, kind: 'line', position: f.position } : { hexagram: f.hexagram.number, kind: f.kind }

/** 主讀與輔讀：原文一律顯示，旁邊或下方依 focus.kind 接上對應的白話與占得提醒。主讀的原文直排 */
function FocusBlock({ focus, main }: { focus: ReadingFocus; main: boolean }) {
  if (main) {
    return (
      <div className="focus-block main">
        <div className="focus-scripture">
          <Scripture text={focusText(focus)} perColumn={9} head={focusTitle(focus)} />
          {FLAGS.collection && <QuoteButton quote={quoteOf(focus)} />}
        </div>
        <div className="focus-notes">
          <p className="note">主讀：{focusTitle(focus)}</p>
          <LinePlain entryKey={keyOf(focus)} label={focusTitle(focus)} />
        </div>
      </div>
    )
  }
  return (
    <div className={main ? 'focus-block main' : 'focus-block'}>
      <div className="focus-head">
        <FocusText focus={focus} main={main} />
        {FLAGS.collection && <QuoteButton quote={quoteOf(focus)} />}
      </div>
      <LinePlain entryKey={keyOf(focus)} label={focusTitle(focus)} />
    </div>
  )
}

export interface ReadingViewProps {
  reading: Reading
  /** 右欄頂端：保存狀態或警示 */
  header?: ReactNode
  /** 右欄底部：筆記、操作按鈕 */
  footer?: ReactNode
}

/** 解讀主體：卡圖、變爻、讀法、主讀輔讀與問事指引；占卜解讀與紀錄詳情共用 */
export function ReadingView({ reading, header, footer }: ReadingViewProps) {
  const { primary, result, moving, reading: r } = buildReading(reading.lines)
  // 之後點進卡牌頁看全息卡的機會大，先把這兩卦排到離線快取的前面
  useEffect(() => {
    void touchCardCache(result.number).then(() => touchCardCache(primary.number))
  }, [primary.number, result.number])
  const [main, ...rest] = r.focus
  return (
    <section className="divine-step result-step" aria-live="polite">
      <div className="result-cards rise" style={rise(0)}>
        <div className="card-pair">
          <Card hex={primary} label="本卦" />
          {moving.length > 0 && <span className="pair-arrow" aria-hidden="true">→</span>}
          {moving.length > 0 && <Card hex={result} label="之卦" />}
        </div>
        <div className="result-glyph">
          <LineBuilder lines={reading.lines} />
          <p className="note">
            {moving.length ? '變爻以朱紅標記（圈為老陽、叉為老陰）；卦畫由下往上讀。' : '六爻皆不變。'}
          </p>
        </div>
        <p className="result-links">
          <Link to={`/gua/${primary.number}`}>看{primary.name}卦完整牌義</Link>
          {moving.length > 0 && <Link to={`/gua/${result.number}`}>看{result.name}卦完整牌義</Link>}
        </p>
      </div>

      <div className="result-text rise" style={rise(1)}>
        {header}
        <h2>該讀哪一段</h2>
        <p>{r.rule}</p>
        <p className="note">{r.ruleExplanation}</p>
        <FocusBlock focus={main} main />
        {rest.length > 0 && (
          <details className="accordion">
            <summary>另一段可參考的經文</summary>
            {rest.map((f, i) => <FocusBlock key={i} focus={f} main={false} />)}
          </details>
        )}
        <GuidancePanel key={reading.id} primary={primary} result={result} initial={main.hexagram} category={reading.category} />
        {FLAGS.najia && <NajiaSection key={`najia-${reading.id}`} reading={reading} />}
        {footer}
      </div>
    </section>
  )
}

export function ResultStep({ reading, status, error, onSaveNote, onAgain, onDownload, onRetry }: Props) {
  const blocked = status === 'failed'
  const [writing, setWriting] = useState(false)
  const hasNote = reading.note.trim().length > 0

  const header = blocked ? (
    <div className="inline-warning" role="alert">
      <p>{isAppError(error, 'STORAGE_QUOTA') ? ERROR_MESSAGES.STORAGE_QUOTA : '這次結果沒有存進紀錄，可以先下載保存。'}</p>
    </div>
  ) : (
    <SaveStatusPill status={status} />
  )

  const footer = (
    <>
      {!blocked && (writing || hasNote) && (
        <NoteEditor label="這次的筆記" value={reading.note} version={reading.rev} autoFocus={writing && !hasNote} placeholder="寫下當下的想法，之後可以回來對照" onSave={onSaveNote} />
      )}
      <div className="step-actions">
        {blocked ? (
          <>
            <button type="button" className="btn btn-primary" onClick={onDownload}>下載這次結果</button>
            <button type="button" className="btn" onClick={onRetry}>重試保存</button>
            <button type="button" className="btn" onClick={onAgain}>再問一事</button>
          </>
        ) : hasNote ? (
          <button type="button" className="btn btn-primary" onClick={onAgain}>再問一事</button>
        ) : (
          <>
            {!writing && <button type="button" className="btn btn-primary" onClick={() => setWriting(true)}>寫下筆記</button>}
            <button type="button" className="btn" onClick={onAgain}>再問一事</button>
          </>
        )}
      </div>
    </>
  )

  return <ReadingView reading={reading} header={header} footer={footer} />
}
