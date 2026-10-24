// 問題步驟：先只有一個輸入框，寫到 2 字以上才展開類別與起卦方式，主 CTA「開始起卦」在最下面。

import { useId, useState } from 'react'
import type { CastDraft, Category, DraftMethod } from '../../storage/index.ts'
import type { DraftSaveState } from './draftQueue.ts'
import { CATEGORY_LABELS, CATEGORY_ORDER, DRAFT_METHOD_LABELS, METHOD_HELP } from './labels.ts'

export const QUESTION_MIN = 2
export const QUESTION_MAX = 200
const len = (s: string) => [...s.trim()].length

interface Props {
  draft: CastDraft
  saveState: DraftSaveState
  onChange: (patch: Partial<Pick<CastDraft, 'question' | 'category' | 'method' | 'yarrowMode'>>) => void
  onStart: () => void
}

const METHODS: DraftMethod[] = ['coins', 'yarrow', 'manual']
const METHOD_NOTES: Record<DraftMethod, string> = { coins: '按六次，最快', yarrow: '古法，變爻機率不同', manual: '用自己的銅錢' }

export function QuestionStep({ draft, saveState, onChange, onStart }: Props) {
  const [help, setHelp] = useState(false)
  const id = useId()
  const count = len(draft.question)
  const ready = count >= QUESTION_MIN

  return (
    <section className="divine-step question-step" aria-labelledby={`${id}-q`}>
      <label id={`${id}-q`} htmlFor={`${id}-input`} className="question-label">心中想著一件事，用一句話寫下來</label>
      <textarea
        id={`${id}-input`}
        className="question-input"
        value={draft.question}
        maxLength={QUESTION_MAX}
        rows={3}
        placeholder="例如：要不要接下新的專案？"
        onChange={e => onChange({ question: e.target.value })}
      />
      <div className="field-meta">
        <span>{[...draft.question].length >= QUESTION_MAX ? '問題最多 200 字。' : saveState === 'failed' ? '進度暫時無法保存，關閉頁面會遺失。' : saveState === 'saved' && draft.question ? '已自動保存' : ''}</span>
        <span>{count}／{QUESTION_MAX}</span>
      </div>

      {ready && (
        <>
          <fieldset className="choice-group">
            <legend>這件事比較屬於哪方面</legend>
            <div className="segmented-radio">
              {CATEGORY_ORDER.map(c => (
                <label key={c}>
                  <input type="radio" name={`${id}-category`} value={c} checked={draft.category === c} onChange={() => onChange({ category: c as Category })} />
                  <span>{CATEGORY_LABELS[c]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="choice-group">
            <legend>
              起卦方式
              <button type="button" className="link-button" aria-expanded={help} onClick={() => setHelp(h => !h)}>這是什麼</button>
            </legend>
            <div className="method-cards">
              {METHODS.map(m => (
                <label key={m} className="method-card">
                  <input type="radio" name={`${id}-method`} value={m} checked={draft.method === m} onChange={() => onChange({ method: m })} />
                  <span><b>{DRAFT_METHOD_LABELS[m]}</b><small>{METHOD_NOTES[m]}</small></span>
                </label>
              ))}
            </div>
            {help && (
              <dl className="method-help">
                {METHODS.map(m => [<dt key={`${m}-t`}>{DRAFT_METHOD_LABELS[m]}</dt>, <dd key={`${m}-d`}>{METHOD_HELP[m]}</dd>])}
              </dl>
            )}
            {draft.method === 'yarrow' && (
              <div className="segmented-radio yarrow-mode" role="radiogroup" aria-label="大衍筮法的方式">
                <label>
                  <input type="radio" name={`${id}-yarrow`} value="quick" checked onChange={() => onChange({ yarrowMode: 'quick' })} />
                  <span>一鍵完成</span>
                </label>
              </div>
            )}
          </fieldset>
        </>
      )}

      <div className="step-actions">
        <button type="button" className="btn btn-primary" disabled={!ready} onClick={onStart}>開始起卦</button>
      </div>
    </section>
  )
}
