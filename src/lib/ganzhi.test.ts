import { describe, expect, it } from 'vitest'
import { BRANCHES, castTime, castTimeLabel, clashOf, dayGanzhi, ganzhiIndex, ganzhiName, monthBranch, voidBranches } from './ganzhi.ts'

const HOUR = 3_600_000
/** 香港天文台公布的時刻（協調世界時加 8 小時） */
const hkt = (y: number, m: number, d: number, h: number, min: number) => Date.UTC(y, m - 1, d, h - 8, min)

describe('六十甲子', () => {
  it('天干地支與六十甲子序互換', () => {
    expect(ganzhiName(0)).toBe('甲子')
    expect(ganzhiName(59)).toBe('癸亥')
    for (let i = 0; i < 60; i++) expect(ganzhiIndex(i % 10, i % 12)).toBe(i)
    expect(() => ganzhiIndex(0, 1)).toThrow(RangeError)
  })

  it('旬空：六旬各空兩個地支（《增刪卜易・旬空章》）', () => {
    const expected = ['戌亥', '申酉', '午未', '辰巳', '寅卯', '子丑']
    for (let day = 0; day < 60; day++) {
      expect(voidBranches(day).map(b => BRANCHES[b]).join(''), ganzhiName(day)).toBe(expected[Math.floor(day / 10)])
    }
  })

  it('六沖', () => {
    expect([0, 1, 2, 3, 4, 5].map(b => BRANCHES[clashOf(b)]).join('')).toBe('午未申酉戌亥')
    expect(clashOf(clashOf(3))).toBe(3)
  })
})

describe('日干支', () => {
  it('已知日期', () => {
    expect(ganzhiName(dayGanzhi(2000, 1, 1))).toBe('戊午')
    expect(ganzhiName(dayGanzhi(2024, 2, 10))).toBe('甲辰')
    expect(ganzhiName(dayGanzhi(1970, 1, 1))).toBe('辛巳')
    // 2026-11-12 對照多個線上曆書：丙午年己亥月庚寅日
    expect(ganzhiName(dayGanzhi(2026, 11, 12))).toBe('庚寅')
  })

  it('每天往後一位，六十天一輪，跨閏日不亂', () => {
    expect(dayGanzhi(2024, 3, 1)).toBe((dayGanzhi(2024, 2, 28) + 2) % 60)
    expect(dayGanzhi(2025, 3, 1)).toBe((dayGanzhi(2025, 2, 28) + 1) % 60)
    expect(dayGanzhi(2026, 3, 2)).toBe(dayGanzhi(2026, 1, 1))
  })
})

describe('月建依節氣的「節」換月', () => {
  // 2026 年交節時刻取自香港天文台「二十四節氣的日期及時間資料」
  const terms: [name: string, at: number, before: string, after: string][] = [
    ['小寒', hkt(2026, 1, 5, 16, 23), '子', '丑'],
    ['立春', hkt(2026, 2, 4, 4, 2), '丑', '寅'],
    ['驚蟄', hkt(2026, 3, 5, 21, 59), '寅', '卯'],
    ['清明', hkt(2026, 4, 5, 2, 40), '卯', '辰'],
    ['芒種', hkt(2026, 6, 5, 23, 48), '巳', '午'],
    ['立秋', hkt(2026, 8, 7, 19, 43), '未', '申'],
  ]

  it.each(terms)('%s 前後一小時分屬兩個月，且都提示接近交節', (_name, at, before, after) => {
    expect(BRANCHES[monthBranch(at - HOUR).branch]).toBe(before)
    expect(BRANCHES[monthBranch(at + HOUR).branch]).toBe(after)
    expect(monthBranch(at - HOUR / 2).nearTerm).toBe(true)
    expect(monthBranch(at + HOUR / 2).nearTerm).toBe(true)
  })

  it('月中不提示；中氣不換月', () => {
    const mid = monthBranch(hkt(2026, 2, 20, 12, 0))
    expect(BRANCHES[mid.branch]).toBe('寅')
    expect(mid.nearTerm).toBe(false)
    // 春分（3 月 20 日 22:46）是中氣，前後都是卯月
    expect(BRANCHES[monthBranch(hkt(2026, 3, 20, 20, 0)).branch]).toBe('卯')
    expect(BRANCHES[monthBranch(hkt(2026, 3, 21, 1, 0)).branch]).toBe('卯')
  })

  it('一年十二個月建依序出現', () => {
    const seen: string[] = []
    for (let d = 0; d < 366; d++) {
      const b = BRANCHES[monthBranch(hkt(2026, 2, 5, 12, 0) + d * 24 * HOUR).branch]
      if (seen.at(-1) !== b) seen.push(b)
    }
    expect(seen.join('')).toBe('寅卯辰巳午未申酉戌亥子丑寅')
  })
})

describe('起卦時刻', () => {
  it('晚上 11 點起算次日的日辰（依裝置本地時間）', () => {
    const day = dayGanzhi(2026, 11, 12)
    expect(castTime(new Date(2026, 10, 12, 22, 59)).day).toBe(day)
    expect(castTime(new Date(2026, 10, 12, 23, 0)).day).toBe((day + 1) % 60)
    expect(castTime(new Date(2026, 10, 13, 0, 30)).day).toBe((day + 1) % 60)
    // 月底、年底也照樣進位
    expect(castTime(new Date(2026, 11, 31, 23, 30)).day).toBe(dayGanzhi(2027, 1, 1))
  })

  it('月建取自時刻', () => {
    expect(BRANCHES[castTime(new Date(hkt(2026, 11, 12, 12, 0))).month]).toBe('亥')
  })

  // 以下都給定時刻與時差，答案和測試機器的時區無關
  it('給了起卦時差就依那個時區換日：台灣 22:59 與 23:00 分屬兩天', () => {
    const day = dayGanzhi(2026, 11, 12)
    expect(castTime(new Date('2026-11-12T14:59:00.000Z'), 480).day).toBe(day)
    expect(castTime(new Date('2026-11-12T15:00:00.000Z'), 480).day).toBe((day + 1) % 60)
  })

  it('同一個時刻在不同時差下日辰不同，所以要用保存的時差而不是查看裝置的', () => {
    // 台灣 11/12 23:30 已算 11/13；同一刻在洛杉磯（UTC−8）是 11/12 07:30
    const at = new Date('2026-11-12T15:30:00.000Z')
    expect(castTime(at, 480).day).toBe(dayGanzhi(2026, 11, 13))
    expect(castTime(at, -480).day).toBe(dayGanzhi(2026, 11, 12))
    expect(castTime(at, 480).month).toBe(castTime(at, -480).month)
  })

  it('跨月、跨年、閏日與半小時時區都照鐘面日期進位', () => {
    expect(castTime(new Date('2026-12-31T15:30:00.000Z'), 480).day).toBe(dayGanzhi(2027, 1, 1))
    expect(castTime(new Date('2028-02-28T15:10:00.000Z'), 480).day).toBe(dayGanzhi(2028, 2, 29))
    expect(castTime(new Date('2028-02-29T15:10:00.000Z'), 480).day).toBe(dayGanzhi(2028, 3, 1))
    // 印度 UTC+5:30：17:29 UTC 是當地 22:59
    expect(castTime(new Date('2026-11-12T17:29:00.000Z'), 330).day).toBe(dayGanzhi(2026, 11, 12))
    expect(castTime(new Date('2026-11-12T17:30:00.000Z'), 330).day).toBe(dayGanzhi(2026, 11, 13))
  })

  it('不合法的時間或時差拋出 RangeError', () => {
    expect(() => castTime(new Date('nope'), 480)).toThrow(RangeError)
    expect(() => castTime(new Date('2026-11-12T00:00:00.000Z'), 1.5)).toThrow(RangeError)
    expect(() => castTime(new Date('2026-11-12T00:00:00.000Z'), NaN)).toThrow(RangeError)
  })

  it('起卦時間的文字依保存的時差顯示鐘面時間並註明時差', () => {
    const at = new Date('2026-11-12T15:30:00.000Z')
    expect(castTimeLabel(at, 480)).toBe('2026/11/12 23:30（UTC+8）')
    expect(castTimeLabel(at, -480)).toBe('2026/11/12 07:30（UTC−8）')
    expect(castTimeLabel(at, 330)).toBe('2026/11/12 21:00（UTC+5:30）')
    expect(castTimeLabel(at, 0)).toBe('2026/11/12 15:30（UTC+0）')
  })
})
