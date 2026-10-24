// 一道題目：題幹（文字、卦畫、看圖卡）與選項。選項用原生 radio，方向鍵與空白鍵就能作答。
// revealed 時標出正解與選錯的那一項，並顯示解說；考核送出前不揭露。

import { useId, type ReactNode } from 'react'
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
}

export function QuestionCard({ question, choice, revealed, disabled = false, onChoose, feedback }: Props) {
  const name = useId()
  const prompt = question.prompt as Prompt
  const options = question.options as Option[]
  const correct = choice === question.answerIndex
  const glyphClass = prompt.glyph && prompt.glyph.length === 3 ? 'q-glyph trigram' : 'q-glyph'
  const hasGlyphOptions = options.some(o => o.glyph)

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
