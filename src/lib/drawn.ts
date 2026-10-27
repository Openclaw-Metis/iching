// 畫卦尋牌：使用者由下而上點出的六爻，每爻可能是未定（null）、陽（1）或陰（0）。
// 一律初爻在前（index 0），與卦象資料相同。

import type { Bit } from '../data/trigrams.ts'

export type DrawnLine = Bit | null
export type Drawn = DrawnLine[]

export const EMPTY_DRAWN: Drawn = [null, null, null, null, null, null]

/** 點一下：未定 → 陽 → 陰 → 未定 */
export const cycleLine = (v: DrawnLine): DrawnLine => (v === null ? 1 : v === 1 ? 0 : null)

export const drawnCount = (d: Drawn) => d.filter(v => v !== null).length

/** 已定的爻都相同才算符合；一爻都沒畫時全部符合 */
export const matchesDrawn = (lines: readonly Bit[], d: Drawn) => d.every((v, i) => v === null || lines[i] === v)
