import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { missingQuotes, normalizeQuote } from '../lib/text.ts'
import { content } from './content.ts'

const source = readFileSync(new URL('../../易經_周易_原文.md', import.meta.url), 'utf8')
// 引文須照原文用字與斷句，比對規則見 src/lib/text.ts
const corpus = normalizeQuote(source)
const entries = Object.entries(content)
const fields = (c: (typeof content)[string]) => [c.motto, c.meaning, c.summary, c.guidance.career, c.guidance.relations, c.guidance.decision]
const len = (s: string) => [...s].length

describe('牌義內容', () => {
  it('64 卦都有內容', () => {
    expect(entries.map(([n]) => Number(n)).sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i + 1))
  })

  it('欄位長度在規格內', () => {
    const problems: string[] = []
    for (const [n, c] of entries) {
      if (c.keywords.length < 3 || c.keywords.length > 4 || c.keywords.some(k => len(k) !== 2)) problems.push(`${n} 關鍵詞`)
      if (len(c.motto) < 8 || len(c.motto) > 20) problems.push(`${n} 一句話牌義 ${len(c.motto)}`)
      if (len(c.meaning) < 60 || len(c.meaning) > 130) problems.push(`${n} 整體牌義 ${len(c.meaning)}`)
      if (len(c.summary) < 200 || len(c.summary) > 360) problems.push(`${n} 白話導讀 ${len(c.summary)}`)
      for (const [k, v] of Object.entries(c.guidance)) if (len(v) < 50 || len(v) > 110) problems.push(`${n} ${k} ${len(v)}`)
    }
    expect(problems).toEqual([])
  })

  it('「」裡的引文都出自原文', () => {
    const missing: string[] = []
    for (const [n, c] of entries) {
      for (const text of fields(c)) {
        for (const quote of missingQuotes(text, corpus)) missing.push(`${n}：「${quote}」`)
      }
    }
    expect(missing).toEqual([])
  })

  it('不使用破折號', () => {
    const dashes = entries.filter(([, c]) => fields(c).some(t => /—|――/.test(t))).map(([n]) => n)
    expect(dashes).toEqual([])
  })
})
