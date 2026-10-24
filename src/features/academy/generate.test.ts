import { describe, expect, it } from 'vitest'
import { textOf } from '../../data/classic.ts'
import { cuo, hexagram, hexagrams, hu, lineLabel, zong } from '../../data/hexagrams.ts'
import { trigrams } from '../../data/trigrams.ts'
import { interpret } from '../../lib/reading.ts'
import type { Uint32Source } from '../../lib/rng.ts'
import { daxiangHalf, focusLabel, generateQuestion, generateSet } from './questions/generate.ts'
import { QUESTION_TYPES, type Question } from './questions/types.ts'

// 可重現的亂數（mulberry32）
function seeded(seed: number): Uint32Source {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }
}

const hundred = (type: (typeof QUESTION_TYPES)[number], seed = 7) => {
  const src = seeded(seed)
  return Array.from({ length: 100 }, () => generateQuestion(type, {}, src))
}
const answer = (q: Question) => q.options[q.answerIndex].label
const NAMES = hexagrams.map(h => h.name)

describe('出題器（TC-08）', () => {
  it.each(QUESTION_TYPES)('%s：100 題的正解都在選項中、選項不重複', type => {
    for (const q of hundred(type)) {
      expect(q.type).toBe(type)
      expect([2, 4]).toContain(q.options.length)
      expect(q.answerIndex).toBeGreaterThanOrEqual(0)
      expect(q.answerIndex).toBeLessThan(q.options.length)
      expect(new Set(q.options.map(o => o.label)).size).toBe(q.options.length)
      expect(q.questionKey.startsWith(`${type}:`)).toBe(true)
      expect(q.explanation.length).toBeGreaterThan(0)
      expect(q.prompt.text.length).toBeGreaterThan(0)
    }
  })

  it('同一個 questionKey 的正解一致', () => {
    const byKey = new Map<string, string>()
    for (const type of QUESTION_TYPES) {
      for (const q of hundred(type, 11)) {
        const prev = byKey.get(q.questionKey)
        if (prev !== undefined) expect(answer(q)).toBe(prev)
        byKey.set(q.questionKey, answer(q))
      }
    }
  })

  it('卦名題的正解對得上卦象', () => {
    for (const q of hundred('glyph-to-name')) {
      const h = hexagram(q.hexagram!)
      expect(answer(q)).toBe(h.name)
      expect(q.prompt.glyph).toEqual(h.lines)
      expect(q.facet).toBe('glyph')
    }
    for (const q of hundred('name-to-glyph')) expect(q.options[q.answerIndex].glyph).toEqual(hexagram(q.hexagram!).lines)
    for (const q of hundred('pair-to-name')) {
      const h = hexagram(q.hexagram!)
      expect(answer(q)).toBe(h.name)
      expect(q.prompt.text).toContain(`上卦是${h.upper.name}`)
    }
    for (const q of hundred('image-to-name')) {
      expect(q.prompt.image).toBe(q.hexagram)
      expect(answer(q)).toBe(hexagram(q.hexagram!).name)
      expect(q.facet).toBe('image')
    }
  })

  it('八卦題的正解來自《說卦》屬性', () => {
    for (const q of hundred('trigram')) {
      const [, variant, id] = q.questionKey.split(':')
      const t = trigrams.find(x => x.id === id)!
      const expected = { 'glyph-name': t.name, 'glyph-image': t.image, 'name-image': t.image, 'name-nature': t.nature, 'name-family': t.family }[variant]
      if (expected) expect(answer(q)).toBe(expected)
      else expect(q.options[q.answerIndex].glyph).toEqual(t.lines)
    }
  })

  it('大象題只給「君子以」等開頭的後半句，題幹不含正解卦名，干擾項不出現在題幹', () => {
    for (const h of hexagrams) expect(daxiangHalf(textOf(h.number).daxiang)).toMatch(/^(君子以|先王以|后以|大人以|上以)/)
    for (const q of hundred('daxiang-to-name')) {
      const h = hexagram(q.hexagram!)
      expect(q.prompt.text).toContain(daxiangHalf(textOf(h.number).daxiang))
      const stem = q.prompt.text.replace(/出自哪一卦的大象？$/, '')
      expect(stem).not.toContain(h.name)
      for (const o of q.options) expect(stem.includes(o.label)).toBe(false)
    }
  })

  it('錯綜互與卦序', () => {
    for (const q of hundred('relation')) {
      const [, kind, n] = q.questionKey.split(':')
      const h = hexagram(Number(n))
      expect(answer(q)).toBe({ cuo: cuo(h), zong: zong(h), hu: hu(h) }[kind]!.name)
    }
    for (const q of hundred('sequence')) {
      const [, variant, n] = q.questionKey.split(':')
      const k = Number(n)
      const expected = variant === 'next' ? k + 1 : variant === 'prev' ? k - 1 : k % 2 ? k + 1 : k - 1
      expect(answer(q)).toBe(NAMES[expected - 1])
    }
  })

  it('爻題：九六與初上的稱呼', () => {
    for (const q of hundred('line-label')) {
      const [, p, b] = q.questionKey.split(':').map(Number)
      expect(answer(q)).toBe(lineLabel(p, b as 0 | 1))
    }
    for (const q of hundred('line-position')) {
      const p = q.prompt.highlight!
      expect(answer(q)).toBe(lineLabel(p, hexagram(q.hexagram!).lines[p]))
    }
    expect(lineLabel(0, 1)).toBe('初九')
    expect(lineLabel(1, 0)).toBe('六二')
    expect(lineLabel(5, 0)).toBe('上六')
  })

  it('position 題符合爻位規則', () => {
    // 獨立寫一次規則，不沿用出題器的實作
    const YANG_POSITIONS = [0, 2, 4]
    const COUNTERPART: Record<number, number> = { 0: 3, 1: 4, 2: 5, 3: 0, 4: 1, 5: 2 }
    for (const q of hundred('position', 3)) {
      const [, variant, n, pStr] = q.questionKey.split(':')
      const p = Number(pStr)
      const lines = hexagram(Number(n)).lines
      const bit = lines[p]
      if (variant === 'proper') expect(answer(q)).toBe(YANG_POSITIONS.includes(p) === (bit === 1) ? '當位' : '不當位')
      if (variant === 'central') expect(answer(q)).toBe(p === 1 || p === 4 ? '是中爻' : '不是中爻')
      if (variant === 'counterpart') expect(answer(q)).toBe(lineLabel(COUNTERPART[p], lines[COUNTERPART[p]]))
      if (variant === 'resonance') expect(answer(q)).toBe(lines[p] !== lines[COUNTERPART[p]] ? '有應' : '無應')
    }
    // 既濟六爻皆當位，未濟六爻皆不當位
    const jiji = generateQuestion('position', { hexagrams: [63], variant: 'proper' }, seeded(1))
    expect(answer(jiji)).toBe('當位')
    const weiji = generateQuestion('position', { hexagrams: [64], variant: 'proper' }, seeded(1))
    expect(answer(weiji)).toBe('不當位')
  })

  it('reading-rule 的正解等於 interpret() 的主讀', () => {
    const src = seeded(5)
    for (let i = 0; i < 100; i++) {
      const q = generateQuestion('reading-rule', {}, src)
      const [, n, moving] = q.questionKey.split(':')
      const r = interpret(hexagram(Number(n)), [...moving].map(Number))
      expect(answer(q)).toBe(focusLabel(r.focus[0]))
    }
    for (const variant of ['0', '1', '2', '3', '4', '5', '6']) {
      const q = generateQuestion('reading-rule', { variant, hexagrams: [1] }, src)
      expect(q.prompt.moving).toHaveLength(Number(variant))
    }
    const useAll = generateQuestion('reading-rule', { variant: '6', hexagrams: [2] }, src)
    expect(answer(useAll)).toBe('坤用六')
  })

  it('text-kind 的題幹出自對應的經傳，文言只出乾坤', () => {
    for (const q of hundred('text-kind', 9)) {
      const [, kind, n, idx] = q.questionKey.split(':')
      const t = textOf(Number(n))
      const source = { judgment: t.judgment, tuan: t.tuan, daxiang: t.daxiang, line: t.lines[Number(idx)]?.text, xiang: t.lines[Number(idx)]?.xiang, wenyan: t.wenyan[Number(idx)] }[kind]!
      const quoted = /^「(.+)」屬於哪一部分？$/.exec(q.prompt.text)![1].replace(/……$/, '')
      expect(source.startsWith(quoted)).toBe(true)
      if (kind === 'wenyan') expect(Number(n)).toBeLessThanOrEqual(2)
      if (Number(n) > 2) expect(q.options.map(o => o.label)).not.toContain('文言')
    }
  })

  it('method-probability 的答案與機率表一致', () => {
    const q = generateQuestion('method-probability', { variant: 'yarrow-most' })
    expect(answer(q)).toBe('少陰（八）')
    expect(answer(generateQuestion('method-probability', { variant: 'yarrow-old-yin' }))).toBe('1/16')
    expect(answer(generateQuestion('method-probability', { variant: 'coins-old-yang' }))).toBe('1/8')
  })

  it('指定範圍時只從這些卦出題；generateSet 盡量不重複', () => {
    const set = generateSet('glyph-to-name', 8, { hexagrams: [1, 2, 29, 30, 51, 52, 57, 58] }, seeded(2))
    expect(new Set(set.map(q => q.hexagram))).toEqual(new Set([1, 2, 29, 30, 51, 52, 57, 58]))
  })
})
