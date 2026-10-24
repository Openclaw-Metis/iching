// 金句的出處與文字（規格「核心資料模型」的 Quote）：種類為卦辭、大象、爻辭與用九用六，
// 爻位用原始索引（初爻為 0），用九用六只限乾坤。文字一律從 textOf 讀取。

import { textOf } from '../../data/classic.ts'
import { hexagram } from '../../data/hexagrams.ts'
import type { TextFocus } from '../../data/lines.ts'
import { track } from '../../lib/events.ts'
import { quotes, type QuoteKind } from '../../storage/index.ts'

export type QuoteRef = quotes.QuoteRef

export const quoteIdOf = (ref: QuoteRef) => quotes.quoteId(ref.hexagram, ref.kind, ref.position)

export function isValidRef(ref: QuoteRef): boolean {
  if (!Number.isInteger(ref.hexagram) || ref.hexagram < 1 || ref.hexagram > 64) return false
  if (ref.kind === 'line') return Number.isInteger(ref.position) && ref.position! >= 0 && ref.position! <= 5
  if (ref.position !== undefined) return false
  if (ref.kind === 'useAll') return ref.hexagram <= 2
  return ref.kind === 'judgment' || ref.kind === 'daxiang'
}

export function parseQuoteId(id: string): QuoteRef | null {
  const m = /^(\d{1,2}):(judgment|daxiang|useAll|line)(?::(\d))?$/.exec(id)
  if (!m) return null
  const ref: QuoteRef = { hexagram: Number(m[1]), kind: m[2] as QuoteKind, ...(m[3] !== undefined ? { position: Number(m[3]) } : {}) }
  return isValidRef(ref) && quoteIdOf(ref) === id ? ref : null
}

export function quoteText(ref: QuoteRef): string {
  const t = textOf(ref.hexagram)
  if (ref.kind === 'judgment') return t.judgment
  if (ref.kind === 'daxiang') return t.daxiang
  return t.lines[ref.kind === 'useAll' ? 6 : ref.position!].text
}

/** 出處，如「屯卦辭」「屯大象」「屯六二」「坤用六」 */
export function quoteSource(ref: QuoteRef): string {
  const name = hexagram(ref.hexagram).name
  if (ref.kind === 'judgment') return `${name}卦辭`
  if (ref.kind === 'daxiang') return `${name}大象`
  return `${name}${textOf(ref.hexagram).lines[ref.kind === 'useAll' ? 6 : ref.position!].label}`
}

/** 卡牌頁經文分頁的深層連結 */
export function quoteHref(ref: QuoteRef): string {
  const focus: TextFocus = ref.kind === 'line' ? `line-${ref.position as 0 | 1 | 2 | 3 | 4 | 5}` : ref.kind === 'useAll' ? 'use' : ref.kind
  return `/gua/${ref.hexagram}?tab=text&focus=${focus}`
}

export async function toggleQuote(ref: QuoteRef): Promise<boolean> {
  if (!isValidRef(ref)) throw new RangeError(`不是可以收藏的經文：${JSON.stringify(ref)}`)
  const on = await quotes.toggle(ref)
  track('quote_toggled', { ref: quoteIdOf(ref), on })
  return on
}
