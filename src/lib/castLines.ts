// 爻值與卦象的換算。爻值 6 老陰、7 少陽、8 少陰、9 老陽；奇數為陽、偶數為陰，6 與 9 為變爻。
// 一律初爻在前（index 0 為初爻），畫面由下往上疊時才倒過來畫。

import { changed, hexagramOf, type Hexagram } from '../data/hexagrams.ts'
import type { Bit } from '../data/trigrams.ts'

export type LineValue = 6 | 7 | 8 | 9

export const isLineValue = (v: unknown): v is LineValue => v === 6 || v === 7 || v === 8 || v === 9
export const lineBit = (v: LineValue): Bit => (v % 2) as Bit
export const isMoving = (v: LineValue) => v === 6 || v === 9

export const movingOf = (lines: readonly LineValue[]) => lines.flatMap((v, i) => (isMoving(v) ? [i] : []))

/** 六個爻值對應的本卦、之卦與變爻位置 */
export function hexagramsOf(lines: readonly LineValue[]): { primary: Hexagram; result: Hexagram; moving: number[] } {
  if (lines.length !== 6 || !lines.every(isLineValue)) throw new RangeError(`不是六個爻值：${lines.join(',')}`)
  const primary = hexagramOf(lines.map(lineBit))
  const moving = movingOf(lines)
  return { primary, result: changed(primary, moving), moving }
}
