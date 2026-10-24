import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LESSON_IDS } from '../../data/stations.ts'
import { missingQuotes, normalizeQuote } from '../../lib/text.ts'
import { EXAM_PLAN, EXAM_SIZE, flatten, LESSONS } from './curriculum.ts'
import { generateQuestion } from './questions/generate.ts'
import { QUESTION_TYPES } from './questions/types.ts'
import { rankOf } from './ranks.ts'

const corpus = normalizeQuote(readFileSync(new URL('../../../易經_周易_原文.md', import.meta.url), 'utf8'))

describe('課綱與課程內容', () => {
  it('24 課齊全，每課 3 到 6 個步驟，至少一段閱讀與一題', () => {
    expect(LESSONS.map(l => l.id)).toEqual(LESSON_IDS)
    for (const l of LESSONS) {
      expect(l.steps.length, l.id).toBeGreaterThanOrEqual(3)
      expect(l.steps.length, l.id).toBeLessThanOrEqual(6)
      expect(l.steps.some(s => s.kind === 'read'), l.id).toBe(true)
      expect(flatten(l).some(s => s.kind === 'question'), l.id).toBe(true)
    }
  })

  it('閱讀 100 字內，「」引文出自原文且斷句一致，沒有破折號', () => {
    const problems: string[] = []
    for (const l of LESSONS) {
      for (const s of l.steps) {
        if (s.kind !== 'read') continue
        if ([...s.text].length > 100) problems.push(`${l.id} 超過 100 字`)
        for (const q of missingQuotes(s.text, corpus)) problems.push(`${l.id}：「${q}」`)
        if (/[—–]|――/.test(s.text)) problems.push(`${l.id} 有破折號`)
      }
    }
    expect(problems).toEqual([])
  })

  it('每一個作答步驟都能出題，S3-L3 含看圖認卦', () => {
    for (const l of LESSONS) {
      for (const s of l.steps) {
        if (s.kind !== 'quiz') continue
        expect(QUESTION_TYPES).toContain(s.type)
        expect(() => generateQuestion(s.type, s.params)).not.toThrow()
      }
    }
    expect(LESSONS.find(l => l.id === 'S3-L3')!.steps.some(s => s.kind === 'quiz' && s.type === 'image-to-name')).toBe(true)
  })

  it('每站考核 10 題，題型依規格', () => {
    const expected: Record<number, string[]> = {
      1: ['line-position', 'line-label'], 2: ['trigram'], 3: ['pair-to-name', 'glyph-to-name', 'image-to-name'], 4: ['sequence'],
      5: ['relation'], 6: ['daxiang-to-name', 'text-kind'], 7: ['position'], 8: ['method-probability', 'reading-rule'],
    }
    for (let s = 1; s <= 8; s++) {
      expect(EXAM_PLAN[s].reduce((n, p) => n + p.count, 0)).toBe(EXAM_SIZE)
      expect(EXAM_PLAN[s].map(p => p.type)).toEqual(expected[s])
    }
  })

  it('修為依通過的最高一站', () => {
    expect(rankOf(0)).toBe('學徒')
    expect(rankOf(2)).toBe('識卦')
    expect(rankOf(8)).toBe('知占')
  })
})
