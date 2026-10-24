import { describe, expect, it } from 'vitest'
import { missingQuotes, normalizeQuote, quoteParts } from './text.ts'

describe('引文正規化（TC-26）', () => {
  it('反斜線與星號被移除', () => {
    expect(normalizeQuote('\\*初九\\*：潛龍勿用')).toBe('初九|潛龍勿用')
  })

  it('句中標點視為同一斷點', () => {
    expect(normalizeQuote('視履，考祥其旋。')).toBe(normalizeQuote('視履。考祥其旋，'))
    expect(normalizeQuote('天行健；君子以自強不息！')).toBe('天行健|君子以自強不息|')
  })

  it('空白與引號被移除', () => {
    expect(normalizeQuote('「天 行　健」『君子』')).toBe('天行健君子')
  })

  it('斷句位置不同時不相等', () => {
    expect(normalizeQuote('視履考祥')).not.toBe(normalizeQuote('視履，考祥'))
  })

  it('刪節號拆成片段並去掉頭尾斷點', () => {
    expect(quoteParts('屯如邅如，……匪寇婚媾。')).toEqual(['屯如邅如', '匪寇婚媾'])
  })

  it('missingQuotes 只回報找不到的引文', () => {
    const corpus = normalizeQuote('履虎尾，不咥人，亨。視履，考祥其旋，元吉。')
    expect(missingQuotes('卦辭說「履虎尾，不咥人」，又說「視履考祥」。', corpus)).toEqual(['視履考祥'])
  })
})
