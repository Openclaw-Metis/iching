import { describe, expect, it } from 'vitest'
import { hexagrams } from '../data/hexagrams.ts'
import { cycleLine, drawnCount, EMPTY_DRAWN, matchesDrawn, type Drawn } from './drawn.ts'

const count = (d: Drawn) => hexagrams.filter(h => matchesDrawn(h.lines, d)).length

describe('畫卦尋牌', () => {
  it('點一下依序為陽、陰、未定', () => {
    expect(cycleLine(null)).toBe(1)
    expect(cycleLine(1)).toBe(0)
    expect(cycleLine(0)).toBeNull()
  })

  it('每畫定一爻，符合的卦減半；六爻畫齊只剩一卦', () => {
    const d: Drawn = [...EMPTY_DRAWN]
    expect(count(d)).toBe(64)
    const qian = [1, 1, 1, 1, 1, 1] as const
    for (let i = 0; i < 6; i++) {
      d[i] = qian[i]
      expect(drawnCount(d)).toBe(i + 1)
      expect(count(d)).toBe(64 / 2 ** (i + 1))
    }
    expect(hexagrams.filter(h => matchesDrawn(h.lines, d)).map(h => h.name)).toEqual(['乾'])
  })

  it('初爻在 index 0：只畫初爻為陽時，屯（初九）符合、蒙（初六）不符合', () => {
    const d: Drawn = [1, null, null, null, null, null]
    expect(matchesDrawn(hexagrams[2].lines, d)).toBe(true)
    expect(matchesDrawn(hexagrams[3].lines, d)).toBe(false)
  })
})
