// 今日卦牌（規格「流程 B：每日一卦」）。還沒抽時背面朝上，點一下或按 Enter 才抽卦；
// 抽到後先在背面朝上的狀態載入正面，正面貼圖就位才翻開，翻開後才載入牌義文字並記 XP。
// 另一個分頁先翻開時，即時訂閱會帶來同一卦，這裡照同樣的步驟翻開，不會出現兩張不同的牌。

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from '../../app/toast.ts'
import { touch as touchCardCache } from '../../app/cardCache.ts'
import { HoloCard } from '../../components/holo/HoloCard.tsx'
import { NoteEditor } from '../../components/NoteEditor.tsx'
import { rise } from '../../components/rise.ts'
import { Scripture } from '../../components/Scripture.tsx'
import { textOf } from '../../data/classic.ts'
import type { CardContent } from '../../data/content.ts'
import { hexagram } from '../../data/hexagrams.ts'
import { ERROR_MESSAGES, isAppError } from '../../lib/errors.ts'
import { track } from '../../lib/events.ts'
import { daily, logError, type DailyDraw } from '../../storage/index.ts'
import { awardDaily } from './daily.ts'
import { HetuLuoshu } from './HetuLuoshu.tsx'

interface Props {
  date: string
  /** 這一天的紀錄；undefined 表示還沒抽 */
  row: DailyDraw | undefined
}

export function TodayCard({ date, row }: Props) {
  // 開頁時已經抽過就直接正面朝上，不重播翻面
  const [revealed, setRevealed] = useState(Boolean(row))
  const [drawing, setDrawing] = useState(false)
  const [text, setText] = useState<CardContent | null | 'failed'>(null)
  const awarded = useRef(false)
  const n = row?.hexagram ?? null

  // 當天紀錄在別處被刪除時回到背面
  useEffect(() => { if (!row) setRevealed(false) }, [row])

  useEffect(() => { if (n !== null) void touchCardCache(n) }, [n])

  useEffect(() => {
    if (!revealed || n === null) return
    let alive = true
    setText(null)
    import('../../data/content.ts').then(
      m => { if (alive) setText(m.content[n] ?? null) },
      () => { if (alive) setText('failed') },
    )
    return () => { alive = false }
  }, [revealed, n])

  const open = async () => {
    if (row || drawing) return
    setDrawing(true)
    try {
      const drawn = await daily.draw()
      track('daily_draw', { hexagram: drawn.hexagram })
    } catch (e) {
      toast(isAppError(e) ? e.message : '這次沒有翻開，請再試一次。')
      logError(isAppError(e) ? e.code : 'DAILY_DRAW_FAILED', String((e as Error)?.message ?? e))
    } finally {
      setDrawing(false)
    }
  }

  // 正面貼圖就位才翻開
  const onFrontReady = () => {
    if (row && !revealed) setRevealed(true)
  }

  // 翻開後記 XP。以日期為鍵，重開頁面再呼叫也不會重複給；上次翻開途中關掉頁面時，這裡會補記
  useEffect(() => {
    if (!revealed || row?.date !== date || awarded.current) return
    awarded.current = true
    awardDaily(date).then(
      r => {
        if (!r.awarded) return
        toast(`翻開今日卦，得到 ${r.awarded} XP`)
        // 達到每日目標可能接上連續天數的印章
        void import('../academy/index.ts').then(m => m.checkAndAnnounce(), () => {})
      },
      e => logError(isAppError(e) ? e.code : 'XP_AWARD_FAILED', String((e as Error)?.message ?? e)),
    )
  }, [revealed, row, date])

  const hex = n === null ? null : hexagram(n)
  const label = revealed && hex
    ? `今日卦牌：${hex.fullName}`
    : '今日卦牌，背面朝上。點一下或按 Enter 翻開'

  return (
    <div className="today">
      <section className="today-stage rise" style={rise(1)}>
        <HoloCard
          front={n}
          back={{ kind: 'deck' }}
          flipped={!revealed}
          rolled={false}
          onClick={revealed ? undefined : open}
          onFrontReady={onFrontReady}
          label={label}
        />
        <p className="stage-caption" aria-live="polite">
          {revealed && hex ? `第${hex.number}卦・${hex.fullName}` : drawing || row ? '翻開中' : '點一下牌背，翻開今天的卦'}
        </p>
      </section>

      {!revealed && <HetuLuoshu />}
      {revealed && hex && (
        <section className="today-text rise" style={rise(2)} aria-live="polite">
          <header>
            <h2>{hex.name}</h2>
            <Link to={`/gua/${hex.number}`}>看完整牌義與經文</Link>
          </header>
          <div className="today-read">
            <Scripture className="today-daxiang" text={textOf(hex.number).daxiang} perColumn={9} head="大象" />
            <div>
              {text === null && <p className="note">牌義載入中</p>}
              {text === 'failed' && <p className="note" role="alert">{ERROR_MESSAGES.CONTENT_LOAD_FAILED}</p>}
              {text && text !== 'failed' && (
                <>
                  <p className="advice">{text.motto}</p>
                  <p>{text.meaning}</p>
                  <h3>今日提醒</h3>
                  <p>{text.guidance.decision}</p>
                </>
              )}
            </div>
          </div>
          {row && (
            <NoteEditor
              label="今日心得"
              value={row.note}
              version={row.rev}
              maxLength={daily.NOTE_MAX}
              placeholder="寫一句今天的體會"
              onSave={(t, rev) => daily.saveNote(date, t, rev ?? row.rev)}
            />
          )}
          <div className="step-actions">
            <Link className="btn" to="/academy">去學堂</Link>
          </div>
        </section>
      )}
    </div>
  )
}
