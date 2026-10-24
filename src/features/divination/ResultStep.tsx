// 解讀步驟：左欄本卦與之卦兩張卡圖（5:7），卦畫以朱紅標出變爻；右欄是保存狀態、讀法說明、主讀經文與白話，
// 下方是輔讀與問事指引。保存失敗（blocked）時解讀照常顯示，主操作改為下載這次結果。

import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { FocusText, focusTitle } from '../../components/FocusText.tsx'
import { LineBuilder } from '../../components/LineBuilder.tsx'
import { LinePlain } from '../../components/LinePlain.tsx'
import { NoteEditor } from '../../components/NoteEditor.tsx'
import { SaveStatusPill, type SaveStatus } from '../../components/SaveStatusPill.tsx'
import { cardAsset } from '../../data/cards.ts'
import type { Hexagram } from '../../data/hexagrams.ts'
import { keyOf } from '../../data/lines.ts'
import { ERROR_MESSAGES, isAppError } from '../../lib/errors.ts'
import type { ReadingFocus } from '../../lib/reading.ts'
import type { Reading } from '../../storage/index.ts'
import { buildReading } from './buildReading.ts'
import { GuidancePanel } from './GuidancePanel.tsx'

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
    <Link to={`/gua/${hex.number}`} className="result-card">
      <img src={cardAsset(hex.number, 'thumb')} alt={`${label}：${hex.fullName}`} width={400} height={560} />
      <span>{label}・{hex.name}</span>
    </Link>
  )
}

/** 主讀與輔讀：原文一律顯示，下方依 focus.kind 接上對應的白話與占得提醒 */
function FocusBlock({ focus, main }: { focus: ReadingFocus; main: boolean }) {
  return (
    <div className={main ? 'focus-block main' : 'focus-block'}>
      <FocusText focus={focus} main={main} />
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
  const [main, ...rest] = r.focus
  return (
    <section className="divine-step result-step" aria-live="polite">
      <div className="result-cards">
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

      <div className="result-text">
        {header}
        <h2>該讀哪一段</h2>
        <p>{r.rule}</p>
        {moving.length === 3 && <p className="note">本站只取朱熹的大原則（本卦卦辭為主、之卦卦辭為輔），沒有再依「前十卦主貞，後十卦主悔」細分。</p>}
        <FocusBlock focus={main} main />
        {rest.length > 0 && (
          <details className="accordion">
            <summary>另一段可參考的經文</summary>
            {rest.map((f, i) => <FocusBlock key={i} focus={f} main={false} />)}
          </details>
        )}
        <GuidancePanel key={reading.id} primary={primary} result={result} initial={main.hexagram} category={reading.category} />
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
