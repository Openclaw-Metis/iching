import { describe, expect, it } from 'vitest'
import { balancedPerColumn, splitColumns } from './columns.ts'

describe('直排分欄', () => {
  it('依字數分欄，接起來與原文相同', () => {
    const text = '坤，元亨，利牝馬之貞。君子有攸往，先迷後得，主利，西南得朋，東北喪朋，安貞吉。'
    const cols = splitColumns(text, 8)
    expect(cols.join('')).toBe(text)
    expect(cols.every(c => [...c].length <= 9)).toBe(true)
  })

  it('句讀與後引號不落在欄首，併入上一欄', () => {
    const cols = splitColumns('乾元亨利貞。初九潛龍', 5)
    expect(cols).toEqual(['乾元亨利貞。', '初九潛龍'])
    for (const c of splitColumns('子曰：「學而時習之」，不亦說乎。', 4)) expect('，。、；：？！」』）'.includes(c[0])).toBe(false)
  })

  it('前引號不留在欄尾', () => {
    const cols = splitColumns('彖曰大哉「乾元」', 5)
    expect(cols).toEqual(['彖曰大哉', '「乾元」'])
  })

  it('字數不合理時拋錯', () => {
    expect(() => splitColumns('乾', 1)).toThrow(RangeError)
  })

  it('依目標欄數分配字數，短文不只一欄、長文不超過上限', () => {
    expect(balancedPerColumn('乾，元亨利貞。', 3, 4, 10)).toBe(4)
    expect(splitColumns('乾，元亨利貞。', 4)).toEqual(['乾，元亨', '利貞。'])
    expect(balancedPerColumn('一'.repeat(39), 3, 4, 10)).toBe(10)
    expect(balancedPerColumn('一'.repeat(20), 3, 4, 10)).toBe(7)
  })
})
