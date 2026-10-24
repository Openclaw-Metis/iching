// 大衍筮法：「大衍之數五十，其用四十有九，分而為二以象兩，掛一以象三，揲之以四以象四時，歸奇於扐以象閏」。
//
// 一變：remaining 根分成左右兩堆（左堆 left 根），從右堆取一根掛起（掛一），左右兩堆各以四根一數，
// 餘數為 1 到 4（整除時算 4），本變移除的根數 = 掛一的 1 + 左餘 + 右餘。左堆至少一根、右堆掛一後也至少一根，
// 所以 left 的合法範圍是 1 到 remaining - 2。三變成一爻，剩下的根數除以 4 即為爻值（36 › 9、32 › 8、28 › 7、24 › 6）。
//
// 一鍵完成不能在合法範圍內均勻選分開位置：49 根時 47 個位置只有 11 個是 4 的倍數，老陽會偏多約 2.3 個百分點。
// 改以均勻亂數決定左堆餘數（1 到 4），再換算成接近中間的分法供動畫顯示，爻值機率才會是 1/16、5/16、7/16、3/16。

import type { LineValue } from '../../lib/castLines.ts'
import { cryptoSource, randomInt, type Uint32Source } from '../../lib/rng.ts'

export const YARROW_TOTAL = 49

export interface YarrowChange {
  /** 本變開始時的根數 */
  start: number
  /** 左堆根數 */
  left: number
  /** 本變移除的根數（掛一加左右兩堆的餘數） */
  removed: number
  /** 本變結束後剩下的根數 */
  remaining: number
}

const rest = (n: number) => n % 4 || 4

/** 合法的左堆範圍 */
export const leftRange = (remaining: number) => ({ min: 1, max: remaining - 2 })

/** 左堆餘數為 target（1 到 4）的分法中，最接近正中間的一個 */
function middleLeftFor(remaining: number, target: number): number {
  const { min, max } = leftRange(remaining)
  const middle = Math.round(remaining / 2)
  for (let d = 0; d <= remaining; d++) {
    for (const left of [middle - d, middle + d]) {
      if (left >= min && left <= max && rest(left) === target) return left
    }
  }
  throw new RangeError(`無法以 ${remaining} 根分出餘數 ${target}`)
}

/** 一變。親手分蓍時傳入使用者選的 left；一鍵完成時不傳，以均勻餘數決定 */
export function yarrowChange(remaining: number, left?: number, source: Uint32Source = cryptoSource): YarrowChange {
  const { min, max } = leftRange(remaining)
  const chosen = left ?? middleLeftFor(remaining, randomInt(1, 4, source))
  if (!Number.isInteger(chosen) || chosen < min || chosen > max) throw new RangeError(`左堆要在 ${min} 到 ${max} 根之間：${chosen}`)
  const removed = 1 + rest(chosen) + rest(remaining - chosen - 1)
  return { start: remaining, left: chosen, removed, remaining: remaining - removed }
}

export interface YarrowLine {
  value: LineValue
  removed: [number, number, number]
  changes: [YarrowChange, YarrowChange, YarrowChange]
}

/** 三變成一爻（一鍵完成） */
export function yarrowLine(source: Uint32Source = cryptoSource): YarrowLine {
  const first = yarrowChange(YARROW_TOTAL, undefined, source)
  const second = yarrowChange(first.remaining, undefined, source)
  const third = yarrowChange(second.remaining, undefined, source)
  return {
    value: (third.remaining / 4) as LineValue,
    removed: [first.removed, second.removed, third.removed],
    changes: [first, second, third],
  }
}

/** 三變後剩下的根數換成爻值 */
export function yarrowValue(remaining: number): LineValue {
  const value = remaining / 4
  if (value !== 6 && value !== 7 && value !== 8 && value !== 9) throw new RangeError(`三變後不可能剩 ${remaining} 根`)
  return value
}
