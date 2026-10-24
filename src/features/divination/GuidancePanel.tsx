// 問事指引：預設顯示主讀所屬那一卦的指引，可切換本卦、之卦。選了類別時展開該類，
// 其餘兩類收在「看其他面向」；不分類時三類都收合但可展開。

import { useState } from 'react'
import type { Hexagram } from '../../data/hexagrams.ts'
import { content } from '../../data/content.ts'
import type { Category } from '../../storage/index.ts'
import { CATEGORY_LABELS } from './labels.ts'

type Facet = Exclude<Category, 'general'>
const FACETS: Facet[] = ['career', 'relations', 'decision']

interface Props {
  primary: Hexagram
  result: Hexagram
  /** 主讀所屬的卦（focus[0].hexagram） */
  initial: Hexagram
  category: Category
}

export function GuidancePanel({ primary, result, initial, category }: Props) {
  const [which, setWhich] = useState<Hexagram>(initial)
  const guidance = content[which.number]?.guidance
  if (!guidance) return null
  const chosen = category === 'general' ? null : category
  const others = FACETS.filter(f => f !== chosen)

  return (
    <section className="guidance-panel" aria-label="問事指引">
      <div className="guidance-head">
        <h3>問事指引</h3>
        {primary !== result && (
          <div className="segmented" role="group" aria-label="看哪一卦的指引">
            <button type="button" aria-pressed={which === primary} onClick={() => setWhich(primary)}>本卦 {primary.name}</button>
            <button type="button" aria-pressed={which === result} onClick={() => setWhich(result)}>之卦 {result.name}</button>
          </div>
        )}
      </div>
      {chosen ? (
        <>
          <details open className="accordion">
            <summary>{CATEGORY_LABELS[chosen]}</summary>
            <p>{guidance[chosen]}</p>
          </details>
          <details className="accordion">
            <summary>看其他面向</summary>
            <dl className="guidance">
              {others.map(f => [<dt key={`${f}-t`}>{CATEGORY_LABELS[f]}</dt>, <dd key={`${f}-d`}>{guidance[f]}</dd>])}
            </dl>
          </details>
        </>
      ) : (
        FACETS.map(f => (
          <details key={f} className="accordion">
            <summary>{CATEGORY_LABELS[f]}</summary>
            <p>{guidance[f]}</p>
          </details>
        ))
      )}
    </section>
  )
}
