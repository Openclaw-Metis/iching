// 讀法指定的經文：卦辭、爻辭或用九用六。經文一律以 textOf 取用，爻位用原始索引（初爻為 0）。

import { textOf } from '../data/classic.ts'
import type { ReadingFocus } from '../lib/reading.ts'

/** 經文出處，如「屯卦辭」「屯六二」「用九」 */
export function focusTitle(focus: ReadingFocus): string {
  const t = textOf(focus.hexagram.number)
  if (focus.kind === 'judgment') return `${focus.hexagram.name}卦辭`
  if (focus.kind === 'useAll') return `${focus.hexagram.name}${t.lines[6].label}`
  return `${focus.hexagram.name}${t.lines[focus.position].label}`
}

export function focusText(focus: ReadingFocus): string {
  const t = textOf(focus.hexagram.number)
  if (focus.kind === 'judgment') return t.judgment
  if (focus.kind === 'useAll') return t.lines[6].text
  return t.lines[focus.position].text
}

export function FocusText({ focus, main }: { focus: ReadingFocus; main: boolean }) {
  return <p className="classic">〔{main ? '主' : '輔'}〕{focusTitle(focus)}：{focusText(focus)}</p>
}
