import { describe, expect, it } from 'vitest'
import { sequenceSource } from '../../lib/rng.ts'
import { castCoinLine } from './coins.ts'
import { manualLine } from './manual.ts'
import { leftRange, yarrowChange, yarrowLine } from './yarrow.ts'

const RUNS = 200_000
const frequencies = (draw: () => number) => {
  const counts: Record<number, number> = { 6: 0, 7: 0, 8: 0, 9: 0 }
  for (let i = 0; i < RUNS; i++) counts[draw()]++
  return counts
}

describe('三錢法', () => {
  it('以固定亂數序列回傳對應的值（TC-01）', () => {
    // 偶數為背面 2、奇數為正面 3
    expect(castCoinLine(sequenceSource([0, 0, 0]))).toEqual({ value: 6, coins: [2, 2, 2] })
    expect(castCoinLine(sequenceSource([1, 0, 1]))).toEqual({ value: 8, coins: [3, 2, 3] })
    expect(castCoinLine(sequenceSource([1, 1, 1]))).toEqual({ value: 9, coins: [3, 3, 3] })
  })

  it('模擬 200,000 爻，頻率與 1/8、3/8、3/8、1/8 相差不超過 0.5 個百分點（AC-01、TC-02）', () => {
    const c = frequencies(() => castCoinLine().value)
    const expected = { 6: 1 / 8, 7: 3 / 8, 8: 3 / 8, 9: 1 / 8 }
    for (const v of [6, 7, 8, 9] as const) expect(Math.abs(c[v] / RUNS - expected[v])).toBeLessThanOrEqual(0.005)
  })
})

describe('大衍筮法', () => {
  it('一鍵完成模擬 200,000 爻，頻率與 1/16、5/16、7/16、3/16 相差不超過 0.5 個百分點（AC-02、TC-02）', () => {
    const c = frequencies(() => yarrowLine().value)
    const expected = { 6: 1 / 16, 7: 5 / 16, 8: 7 / 16, 9: 3 / 16 }
    for (const v of [6, 7, 8, 9] as const) expect(Math.abs(c[v] / RUNS - expected[v])).toBeLessThanOrEqual(0.005)
  })

  it('left 不在 1 到 remaining - 2 之間時拋出 RangeError（AC-03、TC-03）', () => {
    expect(() => yarrowChange(49, 0)).toThrow(RangeError)
    expect(() => yarrowChange(49, 48)).toThrow(RangeError)
    expect(() => yarrowChange(49, 1.5)).toThrow(RangeError)
    expect(() => yarrowChange(49, 1)).not.toThrow()
    expect(() => yarrowChange(49, 47)).not.toThrow()
  })

  it('窮舉合法分法：49 根只移除 5 或 9，44 與 40 根只移除 4 或 8（AC-03、TC-04）', () => {
    const removedFor = (remaining: number) => {
      const { min, max } = leftRange(remaining)
      const seen = new Set<number>()
      for (let left = min; left <= max; left++) seen.add(yarrowChange(remaining, left).removed)
      return [...seen].sort((a, b) => a - b)
    }
    expect(removedFor(49)).toEqual([5, 9])
    expect(removedFor(44)).toEqual([4, 8])
    expect(removedFor(40)).toEqual([4, 8])
  })

  it('三變後剩下的根數只會是 24、28、32、36', () => {
    const ends = new Set<number>()
    for (let i = 0; i < 2000; i++) ends.add(yarrowLine().changes[2].remaining)
    expect([...ends].sort((a, b) => a - b)).toEqual([24, 28, 32, 36])
  })

  it('一鍵完成的分法接近中間，且左堆餘數等於亂數決定的值', () => {
    // randomInt(1, 4) 依序取到 4、1、3：第一變左餘 4、移除 9；第二、三變移除 4 與 8
    const line = yarrowLine(sequenceSource([3, 0, 2]))
    expect(line.removed).toEqual([9, 4, 8])
    expect(line.value).toBe(7)
    for (const c of line.changes) expect(Math.abs(c.left - c.start / 2)).toBeLessThanOrEqual(3)
  })
})

describe('手動輸入', () => {
  it('0、1、2、3 枚正面分別得到 6、7、8、9（AC-04）', () => {
    expect([0, 1, 2, 3].map(manualLine)).toEqual([6, 7, 8, 9])
    expect(() => manualLine(4)).toThrow(RangeError)
  })
})
