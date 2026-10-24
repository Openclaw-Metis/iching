import { describe, expect, it } from 'vitest'
import { randomBit, randomInt, sequenceSource } from './rng.ts'

describe('均勻亂數', () => {
  it('randomInt(1, 4) 跑 100,000 次，各值比例與 25% 相差不超過 1 個百分點', () => {
    const counts = [0, 0, 0, 0]
    const runs = 100_000
    for (let i = 0; i < runs; i++) counts[randomInt(1, 4) - 1]++
    for (const c of counts) expect(Math.abs(c / runs - 0.25)).toBeLessThanOrEqual(0.01)
  })

  it('拒絕取樣：落在最後不完整一段的值會被丟掉重抽', () => {
    // span 為 3 時，2^32 - (2^32 % 3) 以上的值必須丟棄；4294967295 正好在丟棄區
    const r = randomInt(0, 2, sequenceSource([4294967295, 7]))
    expect(r).toBe(1)
  })

  it('注入的序列可重現', () => {
    const src = sequenceSource([0, 1, 2, 3])
    expect([randomInt(1, 4, src), randomInt(1, 4, src), randomInt(1, 4, src), randomInt(1, 4, src)]).toEqual([1, 2, 3, 4])
  })

  it('randomBit 只會是 0 或 1', () => {
    const seen = new Set(Array.from({ length: 200 }, () => randomBit()))
    expect([...seen].sort()).toEqual([0, 1])
  })

  it('範圍不合法時拋錯', () => {
    expect(() => randomInt(3, 1)).toThrow(RangeError)
    expect(() => randomInt(0.5, 2)).toThrow(RangeError)
  })
})
