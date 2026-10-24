// 經傳原文的唯一取用入口。classic.json 依卦序排列，第 n 卦在 hexagrams[n - 1]；
// lines[0] 到 lines[5] 是初爻到上爻，乾坤另有 lines[6] 為用九、用六。

import classic from './classic.json'

export type ClassicHexagram = (typeof classic.hexagrams)[number]

export function textOf(n: number): ClassicHexagram {
  const t = classic.hexagrams[n - 1]
  if (!Number.isInteger(n) || !t) throw new RangeError(`沒有第 ${n} 卦`)
  return t
}

export const classicSource = classic.source
