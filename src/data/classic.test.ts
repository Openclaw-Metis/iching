import { describe, expect, it } from 'vitest'
import { textOf } from './classic.ts'

describe('textOf', () => {
  it('卦序對到正確的卦辭', () => {
    expect(textOf(1).judgment.startsWith('乾')).toBe(true)
    expect(textOf(2).judgment.startsWith('坤')).toBe(true)
    expect(textOf(64).judgment.startsWith('未濟')).toBe(true)
  })

  it('爻位用原始索引：lines[0] 是初爻，乾坤的 lines[6] 是用九用六', () => {
    expect(textOf(1).lines[0].label).toBe('初九')
    expect(textOf(1).lines[5].label).toBe('上九')
    expect(textOf(1).lines[6].label).toBe('用九')
    expect(textOf(2).lines[6].label).toBe('用六')
    expect(textOf(3).lines).toHaveLength(6)
  })

  it('卦序超出範圍時拋錯', () => {
    expect(() => textOf(0)).toThrow(RangeError)
    expect(() => textOf(65)).toThrow(RangeError)
  })
})
