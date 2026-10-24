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
})
