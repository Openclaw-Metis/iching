// 問事指引：預設顯示主讀所屬那一卦的指引，可切換本卦、之卦。選了類別時展開該類，
// 其餘兩類收在「看其他面向」；不分類時沒有哪一類比較重要，三類直接列成清單。
// 每一類後面接民間占斷，最後一項是身體與作息（規格「問事指引的民間占斷」）。

import { useState } from 'react'
import { FolkLine, FolkNote, FolkWellness, useFolk } from '../../components/FolkReading.tsx'
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
  const folk = useFolk(which.number)
  const guidance = content[which.number]?.guidance
  if (!guidance) return null
  const item = (f: Facet) => [<dt key={`${f}-t`}>{CATEGORY_LABELS[f]}</dt>, <dd key={`${f}-d`}>{guidance[f]}<FolkLine folk={folk} facet={f} /></dd>]
  const wellness = <FolkWellness folk={folk} />
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
            <FolkLine folk={folk} facet={chosen} />
          </details>
          <details className="accordion">
            <summary>看其他面向</summary>
            <dl className="guidance">
              {others.map(item)}
              {wellness}
            </dl>
          </details>
        </>
      ) : (
        <dl className="guidance">
          {FACETS.map(item)}
          {wellness}
        </dl>
      )}
      <FolkNote folk={folk} />
    </section>
  )
}
