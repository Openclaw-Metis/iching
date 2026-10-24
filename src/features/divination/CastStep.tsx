// 起卦步驟：左側（手機為上方）是逐漸長高的卦畫，右側是操作區。
// 三錢法每按一次擲一爻；手動輸入點選幾枚正面。按下後到新爻畫完前停用按鈕，避免連點。

import { useEffect, useRef, useState } from 'react'
import { LineBuilder } from '../../components/LineBuilder.tsx'
import type { LineValue } from '../../lib/castLines.ts'
import type { CastDraft } from '../../storage/index.ts'
import { castCoinLine, type Coin } from './coins.ts'
import type { DraftSaveState } from './draftQueue.ts'
import { LINE_NAMES, MANUAL_RULE } from './labels.ts'
import { manualLine } from './manual.ts'
import { yarrowChange, type YarrowChange } from './yarrow.ts'
import { handStart, stepNumber } from './yarrowHand.ts'
import { YarrowSplitter } from './YarrowSplitter.tsx'

const ORDINAL = ['初', '二', '三', '四', '五', '上']
const COOLDOWN_MS = 300

interface Props {
  draft: CastDraft
  saveState: DraftSaveState
  onLine: (value: LineValue) => void
  /** 親手分蓍的一變 */
  onSplit: (left: number) => void
  onAbandon: () => void
}

export function CastStep({ draft, saveState, onLine, onSplit, onAbandon }: Props) {
  const [coins, setCoins] = useState<Coin[] | null>(null)
  const [cooling, setCooling] = useState(false)
  const [lastChange, setLastChange] = useState<YarrowChange | null>(null)
  const castButton = useRef<HTMLButtonElement>(null)
  const done = draft.lines.length
  const next = Math.min(done + 1, 6)

  useEffect(() => () => setCooling(false), [])
  useEffect(() => { castButton.current?.focus() }, [])

  const cast = (value: LineValue) => {
    if (cooling || done >= 6) return
    setCooling(true)
    setTimeout(() => setCooling(false), COOLDOWN_MS)
    onLine(value)
  }

  const last = draft.lines.at(-1)
  return (
    <section className="divine-step cast-step">
      <div className="cast-figure">
        <LineBuilder lines={draft.lines} />
      </div>
      <div className="cast-panel">
        <p className="cast-progress" aria-live="polite">
          起卦中：第 {next} 爻／共 6 爻
          {last !== undefined && <small>上一爻：{ORDINAL[done - 1]}爻{LINE_NAMES[last]}（{last}）</small>}
        </p>

        {draft.method === 'coins' && (
          <>
            <div className="coins" aria-hidden="true">
              {(coins ?? [0, 0, 0]).map((c, i) => <span key={i} className="coin" data-face={c === 3 ? 'head' : c === 2 ? 'tail' : 'idle'}>{c === 3 ? '正' : c === 2 ? '背' : ''}</span>)}
            </div>
            <button
              ref={castButton}
              type="button"
              className="btn btn-primary"
              disabled={cooling}
              onClick={() => {
                const line = castCoinLine()
                setCoins(line.coins)
                cast(line.value)
              }}
            >
              擲第 {next} 爻
            </button>
          </>
        )}

        {draft.method === 'manual' && (
          <>
            <div className="manual-buttons" role="group" aria-label={`第 ${next} 爻：三枚銅錢中有幾枚正面`}>
              {[0, 1, 2, 3].map(heads => (
                <button key={heads} ref={heads === 0 ? castButton : undefined} type="button" className="btn" disabled={cooling} onClick={() => cast(manualLine(heads))}>
                  {heads} 枚正面
                </button>
              ))}
            </div>
            <p className="note">{MANUAL_RULE}</p>
          </>
        )}

        {draft.method === 'yarrow' && (() => {
          const hand = draft.yarrow ?? handStart(done)
          return (
            <YarrowSplitter
              remaining={hand.remaining}
              step={stepNumber(hand)}
              lastChange={lastChange}
              disabled={cooling || done >= 6}
              onSplit={left => {
                if (cooling) return
                setCooling(true)
                setTimeout(() => setCooling(false), COOLDOWN_MS)
                setLastChange(yarrowChange(hand.remaining, left))
                onSplit(left)
              }}
            />
          )
        })()}

        {saveState === 'failed' && <p className="inline-warning" role="alert">進度暫時無法保存，關閉頁面會遺失。</p>}

        <button type="button" className="link-button abandon" onClick={onAbandon}>放棄這次起卦</button>
      </div>
    </section>
  )
}
