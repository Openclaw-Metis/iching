// TC-05：預期值由測試內獨立寫的規則算出，不呼叫 interpret、changed 或 buildReading
import { describe, expect, it } from 'vitest'
import { textOf } from '../../data/classic.ts'
import { hexagramOf, hexagrams } from '../../data/hexagrams.ts'
import type { Bit } from '../../data/trigrams.ts'
import type { LineValue } from '../../lib/castLines.ts'
import { buildReading } from './buildReading.ts'

type Expected = { kind: 'judgment' | 'line' | 'useAll'; hexagram: number; position?: number }

// 6、8 為陰，7、9 為陽，6、9 為變爻
const valueOf = (bit: Bit, moving: boolean): LineValue => (bit ? (moving ? 9 : 7) : (moving ? 6 : 8))

function expectedFocus(primary: number, result: number, moving: number[]): Expected[] {
  const still = [0, 1, 2, 3, 4, 5].filter(i => !moving.includes(i))
  switch (moving.length) {
    case 0: return [{ kind: 'judgment', hexagram: primary }]
    case 1: return [{ kind: 'line', hexagram: primary, position: moving[0] }]
    case 2: return [{ kind: 'line', hexagram: primary, position: moving[1] }, { kind: 'line', hexagram: primary, position: moving[0] }]
    case 3: return [{ kind: 'judgment', hexagram: primary }, { kind: 'judgment', hexagram: result }]
    case 4: return [{ kind: 'line', hexagram: result, position: still[0] }, { kind: 'line', hexagram: result, position: still[1] }]
    case 5: return [{ kind: 'line', hexagram: result, position: still[0] }]
    default: return primary <= 2 ? [{ kind: 'useAll', hexagram: primary }] : [{ kind: 'judgment', hexagram: result }]
  }
}

describe('buildReading 窮舉 64 卦 × 64 種變爻組合', () => {
  it('本卦、之卦、focus 種類、卦序、爻位與主輔順序都正確，且每個主讀都找得到原文（AC-05 原文部分）', () => {
    let checked = 0
    for (const h of hexagrams) {
      for (let mask = 0; mask < 64; mask++) {
        const moving = [0, 1, 2, 3, 4, 5].filter(i => mask & (1 << i))
        const lines = h.lines.map((bit, i) => valueOf(bit, moving.includes(i)))
        const resultBits = h.lines.map((bit, i) => (moving.includes(i) ? 1 - bit : bit) as Bit)
        const result = hexagramOf(resultBits).number

        const built = buildReading(lines)
        expect(built.primary.number).toBe(h.number)
        expect(built.result.number).toBe(result)
        expect(built.moving).toEqual(moving)
        const focus = built.reading.focus.map(f => ({ kind: f.kind, hexagram: f.hexagram.number, ...(f.kind === 'line' ? { position: f.position } : {}) }))
        expect(focus).toEqual(expectedFocus(h.number, result, moving))

        for (const f of built.reading.focus) {
          const t = textOf(f.hexagram.number)
          const text = f.kind === 'judgment' ? t.judgment : f.kind === 'useAll' ? t.lines[6]?.text : t.lines[f.position]?.text
          expect(text, `${h.number} ${mask}`).toBeTruthy()
        }
        checked++
      }
    }
    expect(checked).toBe(4096)
  })

  it('人工核對：屯卦六二一爻變讀屯六二', () => {
    const r = buildReading([7, 6, 8, 8, 7, 8])
    expect(r.primary.name).toBe('屯')
    expect(r.result.name).toBe('節')
    expect(r.reading.focus).toEqual([{ kind: 'line', hexagram: r.primary, position: 1 }])
  })

  it('人工核對：乾卦初、三、五爻變，三爻變讀本卦與之卦卦辭', () => {
    // 變後由下而上為陰陽陰陽陰陽：下坎上離，火水未濟
    const r = buildReading([9, 7, 9, 7, 9, 7])
    expect(r.result.name).toBe('未濟')
    expect(r.reading.focus.map(f => [f.kind, f.hexagram.name])).toEqual([['judgment', '乾'], ['judgment', '未濟']])
  })

  it('人工核對：五爻變讀之卦唯一不變爻', () => {
    // 坤初到五爻變、上爻不變：之卦為澤天夬，讀夬上六
    const r = buildReading([6, 6, 6, 6, 6, 8])
    expect(r.result.name).toBe('夬')
    expect(r.reading.focus).toEqual([{ kind: 'line', hexagram: r.result, position: 5 }])
  })

  it('人工核對：乾坤六爻全變讀用九、用六', () => {
    expect(buildReading([9, 9, 9, 9, 9, 9]).reading.focus[0]).toMatchObject({ kind: 'useAll' })
    expect(textOf(1).lines[6].label).toBe('用九')
    const kun = buildReading([6, 6, 6, 6, 6, 6])
    expect(kun.reading.focus[0]).toMatchObject({ kind: 'useAll' })
    expect(kun.result.name).toBe('乾')
    expect(textOf(2).lines[6].label).toBe('用六')
  })
})
