import { describe, expect, it } from 'vitest'
import { hexagrams } from '../../data/hexagrams.ts'
import { BRANCHES, STEMS, ganzhiIndex } from '../../lib/ganzhi.ts'
import { najia } from '../../lib/najia.ts'
import { chartText } from './chartText.ts'

const byName = (name: string) => hexagrams.find(h => h.name === name)!
const time = (month: string, day: string) => ({ month: BRANCHES.indexOf(month), day: ganzhiIndex(STEMS.indexOf(day[0]), BRANCHES.indexOf(day[1])) })

describe('複製排盤的文字', () => {
  // 渙之井，亥月庚寅日：有變爻、伏神、旬空與月破
  const at = time('亥', '庚寅')
  const chart = najia(byName('渙'), [2, 5], at)

  it('只複製排盤：卦名、宮、日月旬空與六爻各一行，預設不含問題與提問詞', () => {
    const text = chartText(chart, at, { castAtLabel: '2026/11/12 19:25' })
    expect(text.split('\n')).toEqual([
      '【納甲六爻排盤】',
      '本卦：風水渙（離宮五世卦，宮五行火）',
      '之卦：水風井',
      '月建：亥月　日辰：庚寅日　旬空：午未',
      '（依起卦時間 2026/11/12 19:25 換算；月建依節氣，晚上 11 點後算次日）',
      '本卦六爻不見妻財、官鬼；伏神取自本宮首卦離為火',
      '六爻由上爻到初爻：',
      '上爻　螣蛇　陽動　父母辛卯木　變爻：官鬼戊子水',
      '五爻（世）　勾陳　陽靜　兄弟辛巳火（月破）',
      '四爻　朱雀　陰靜　子孫辛未土（旬空）　伏神：妻財己酉金，伏在本爻之下',
      '三爻　青龍　陰動　兄弟戊午火（旬空）　變爻：妻財辛酉金　伏神：官鬼己亥水，伏在本爻之下',
      '二爻（應）　玄武　陽靜　子孫戊辰土',
      '初爻　白虎　陰靜　父母戊寅木',
      '說明：世、應指本卦的爻位；變爻與伏神的六親都依本卦的宮；旬空、月破、日沖各屬它所附的那一爻；日沖只標出與日辰相沖，是暗動還是日破沒有判斷。',
      '排盤出自易經卦殿（京房納甲）。',
    ])
    expect(text.split('\n').some(l => l.startsWith('問題：'))).toBe(false)
    expect(text).not.toContain('請以')
  })

  it('自己改過月建日辰時註明是自行指定', () => {
    expect(chartText(chart, at)).toContain('（月建與日辰為自行指定）')
  })

  it('附上問題：放在排盤標題下，前後空白去掉；空白的問題不出現', () => {
    const lines = chartText(chart, at, { question: '  要不要換工作？ ' }).split('\n')
    expect(lines[1]).toBe('問題：要不要換工作？')
    expect(chartText(chart, at, { question: '   ' }).split('\n').some(l => l.startsWith('問題：'))).toBe(false)
  })

  it('附上提問詞：排在排盤之前，要求不要重排；固定七條，沒附問題時要對方先問', () => {
    const without = chartText(chart, at, { withPrompt: true })
    expect(without.indexOf('請以熟悉六爻納甲筮法')).toBe(0)
    expect(without.indexOf('【納甲六爻排盤】')).toBeGreaterThan(without.indexOf('不要重新起卦'))
    expect(without).toContain('如果下面沒有「問題：」這一行，請先問我')
    expect(without.split('\n').some(l => l.startsWith('問題：'))).toBe(false)
    const withQuestion = chartText(chart, at, { withPrompt: true, question: '要不要換工作？' })
    expect(withQuestion.split('\n')).toContain('問題：要不要換工作？')
    // 條號連續
    const numbers = (t: string) => t.split('\n').flatMap(l => /^(\d+)\. /.exec(l)?.[1] ?? [])
    expect(numbers(without)).toEqual(['1', '2', '3', '4', '5', '6', '7'])
    expect(numbers(withQuestion)).toEqual(numbers(without))
  })

  it('靜卦寫明六爻皆不變；不缺六親時沒有伏神那一行', () => {
    const still = time('寅', '丙辰')
    const text = chartText(najia(byName('臨'), [], still), still)
    expect(text).toContain('之卦：無（六爻皆不變）')
    expect(text).not.toContain('伏神：')
    expect(text).not.toContain('變爻：')
    expect(text).not.toMatch(/[陰陽]動/)
  })

  it('64 卦都排得出六行爻，沒有 undefined', () => {
    for (const h of hexagrams) {
      const text = chartText(najia(h, [0, 3], at), at, { withPrompt: true })
      expect(text.split('\n').filter(l => /^[初二三四五上]爻[（　]/.test(l))).toHaveLength(6)
      expect(text).not.toMatch(/undefined|NaN/)
    }
  })
})
