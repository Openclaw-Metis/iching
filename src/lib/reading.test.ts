import { describe, expect, it } from 'vitest'
import { hexagram } from '../data/hexagrams.ts'
import { interpret } from './reading.ts'

describe('變爻讀法', () => {
  it('不變讀本卦卦辭', () => {
    const r = interpret(hexagram(3), [])
    expect(r.result).toBe(hexagram(3))
    expect(r.focus).toEqual([{ kind: 'judgment', hexagram: hexagram(3) }])
  })

  it('二爻變以上爻為主', () => {
    const r = interpret(hexagram(1), [4, 1])
    expect(r.focus.map(f => f.kind === 'line' && f.position)).toEqual([4, 1])
  })

  it('四爻變讀之卦不變爻，下爻為主', () => {
    const r = interpret(hexagram(1), [0, 2, 3, 5])
    expect(r.result.lines).toEqual([0, 1, 0, 0, 1, 0])
    expect(r.focus).toEqual([
      { kind: 'line', hexagram: r.result, position: 1 },
      { kind: 'line', hexagram: r.result, position: 4 },
    ])
  })

  it('乾坤全變讀用九用六，其他卦讀之卦', () => {
    expect(interpret(hexagram(1), [0, 1, 2, 3, 4, 5]).focus[0].kind).toBe('useAll')
    const r = interpret(hexagram(3), [0, 1, 2, 3, 4, 5])
    expect(r.result.name).toBe('鼎')
    expect(r.focus).toEqual([{ kind: 'judgment', hexagram: r.result }])
  })

  it('每一種情況都有讀法與說明（AC-32）', () => {
    const all = [0, 1, 2, 3, 4, 5]
    const cases: [number, number[]][] = [...all.map((n): [number, number[]] => [3, all.slice(0, n)]), [3, all], [1, all], [2, all]]
    const seen = new Set<string>()
    for (const [n, moving] of cases) {
      const r = interpret(hexagram(n), moving)
      expect(r.rule).toBeTruthy()
      expect(r.ruleExplanation).toBeTruthy()
      seen.add(r.ruleExplanation)
    }
    // 乾坤共用一段說明
    expect(seen.size).toBe(8)
    expect(interpret(hexagram(1), all).rule).toContain('用九')
    expect(interpret(hexagram(2), all).rule).toContain('用六')
  })

  it('爻位不是 0 到 5 的整數時丟出 RangeError，重複的爻位視為同一爻', () => {
    for (const bad of [-1, 6, 1.5, Number.NaN]) expect(() => interpret(hexagram(1), [bad])).toThrow(RangeError)
    expect(interpret(hexagram(1), [2, 2]).moving).toEqual([2])
  })
})
