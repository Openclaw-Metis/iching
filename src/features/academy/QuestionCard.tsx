// 一道題目：題幹（文字、卦畫、看圖卡）與選項。選項用原生 radio，方向鍵與空白鍵就能作答。
// 另外數字鍵選答、Enter 按主按鈕（檢查、下一步、送出），見規格「2026-10-29 介面檢視後修訂」。
// revealed 時標出正解與選錯的那一項，並顯示解說；考核送出前不揭露。

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { HexagramGlyph } from '../../components/HexagramGlyph.tsx'
import { cardAsset } from '../../data/cards.ts'
import type { Bit } from '../../data/trigrams.ts'
import type { QuestionSnapshot } from '../../storage/index.ts'
import type { Option, Prompt } from './questions/types.ts'

interface Props {
  question: QuestionSnapshot
  choice: number | null
  revealed: boolean
  disabled?: boolean
  onChoose: (index: number) => void
  /** 揭露後附在解說上方，例如本題 XP */
  feedback?: ReactNode
  /** 按 Enter 時執行的主按鈕動作；主按鈕停用時不給 */
  onEnter?: () => void
}

// 焦點在這些元素上時 Enter 與數字鍵本來就有作用（按下按鈕、輸入文字），不攔截；radio 例外，那正是選項本身
const OWN_KEYS = 'button, a, summary, select, textarea, input:not([type="radio"]), [contenteditable]'

function useAnswerKeys(count: number, locked: boolean, onChoose: (i: number) => void, onEnter?: () => void) {
  const latest = useRef({ count, locked, onChoose, onEnter })
  latest.current = { count, locked, onChoose, onEnter }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
      if ((e.target as Element | null)?.closest?.(OWN_KEYS) || document.querySelector('dialog[open]')) return
      const k = latest.current
      if (e.key === 'Enter') {
        if (!k.onEnter) return
        e.preventDefault()
        k.onEnter()
        return
      }
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1 || n > k.count || k.locked) return
      e.preventDefault()
      k.onChoose(n - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
}

export function QuestionCard({ question, choice, revealed, disabled = false, onChoose, feedback, onEnter }: Props) {
  const name = useId()
  const prompt = question.prompt as Prompt
  const options = question.options as Option[]
  const correct = choice === question.answerIndex
  const glyphClass = prompt.glyph && prompt.glyph.length === 3 ? 'q-glyph trigram' : 'q-glyph'
  const hasGlyphOptions = options.some(o => o.glyph)
  useAnswerKeys(Math.min(options.length, 9), disabled || revealed, onChoose, onEnter)

  return (
    <div className="question">
      <p className="q-prompt" id={`${name}-prompt`}>{prompt.text}</p>
      {(prompt.glyph || prompt.image) && (
        <div className="q-figure">
          {prompt.glyph && <HexagramGlyph lines={prompt.glyph as Bit[]} className={glyphClass} highlight={prompt.highlight} moving={prompt.moving} />}
          {prompt.image && (
            <img className="q-image" src={cardAsset(prompt.image, 'quiz')} alt="看圖猜卦的卡圖，只有背景與主體" width={300} height={420} />
          )}
        </div>
      )}
      <div className={hasGlyphOptions ? 'q-options glyphs' : 'q-options'} role="radiogroup" aria-labelledby={`${name}-prompt`}>
        {options.map((o, i) => {
          const state = revealed ? (i === question.answerIndex ? 'correct' : i === choice ? 'wrong' : undefined) : undefined
          return (
            <label key={i} className="q-option" data-state={state}>
              <input type="radio" name={name} checked={choice === i} disabled={disabled || revealed} onChange={() => onChoose(i)} aria-label={o.glyph ? o.label : undefined} />
              <span>
                {i < 9 && <kbd className="q-key" aria-hidden="true">{i + 1}</kbd>}
                {o.glyph ? <HexagramGlyph lines={o.glyph as Bit[]} className={o.glyph.length === 3 ? 'q-opt-glyph trigram' : 'q-opt-glyph'} /> : o.label}
              </span>
            </label>
          )
        })}
      </div>
      {revealed && (
        <div className="q-explain" role="status" data-correct={correct || undefined}>
          <p className="q-verdict">{choice === null ? '' : correct ? '答對了' : `正解是「${options[question.answerIndex].label}」`}</p>
          {feedback}
          <p>{question.explanation}</p>
        </div>
      )}
    </div>
  )
}
