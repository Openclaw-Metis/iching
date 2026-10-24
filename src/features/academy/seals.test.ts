import { afterEach, describe, expect, it } from 'vitest'
import { FLAGS } from '../../app/flags.ts'
import { addDays } from '../../lib/dates.ts'
import type { CheckIn, ExamResult, LessonProgress, Mastery, Reading, XpEvent } from '../../storage/index.ts'
import { evaluateSeals, isSealShown, SEALS, shownSeals, type AchievementData } from './seals.ts'

const T = (d: number, h = 10) => new Date(Date.UTC(2026, 9, d, h)).toISOString()
const empty = (): AchievementData => ({ progress: [], exams: [], checkIns: [], mastery: [], xpEvents: [], readings: [] })
const earnedOf = (d: AchievementData) => Object.fromEntries(evaluateSeals(d).map(s => [s.id, s.earnedAt]))

const lesson = (lessonId: string, completedAt: string | null, status: LessonProgress['status'] = 'completed'): LessonProgress =>
  ({ lessonId, stationId: Number(lessonId[1]), status, step: 3, correct: 3, total: 3, completedAt, updatedAt: completedAt ?? T(1) })
const exam = (stationId: number, passed: boolean, at: string): ExamResult => ({ id: crypto.randomUUID(), attemptId: 'a', stationId, score: passed ? 9 : 5, passed, at })
const reading = (over: Partial<Reading>): Reading => ({
  id: crypto.randomUUID(), createdAt: T(1), updatedAt: T(1), rev: 1, question: '問題', category: 'general', method: 'coins', lines: [7, 7, 7, 7, 7, 7],
  primary: 1, result: 1, moving: [], note: '', followUp: null, starred: 0, v: 1, deletedAt: null, ...over,
})

describe('15 枚印章（AC-19）', () => {
  it('沒有資料時一枚都沒有；印譜共 15 枚', () => {
    expect(evaluateSeals(empty())).toEqual([])
    expect(SEALS).toHaveLength(15)
    expect(new Set(SEALS.map(s => s.char)).size).toBe(15)
  })

  it('初：最早完成的一課', () => {
    const d = empty()
    d.progress = [lesson('S1-L2', T(5)), lesson('S1-L1', T(3)), lesson('S1-L3', null, 'in-progress')]
    expect(earnedOf(d).first).toBe(T(3))
  })

  it.each([[1, 'qian'], [2, 'dui'], [3, 'li'], [4, 'zhen'], [5, 'xun'], [6, 'kan'], [7, 'gen'], [8, 'kun']] as const)('第 %i 站：%s 印取最早一次通過', (station, id) => {
    const d = empty()
    d.exams = [exam(station, false, T(2)), exam(station, true, T(6)), exam(station, true, T(4))]
    expect(earnedOf(d)[id]).toBe(T(4))
  })

  it('七與卅：第一段連續 N 天的第 N 天', () => {
    const d = empty()
    const run = (start: string, days: number): CheckIn[] => Array.from({ length: days }, (_, i) => ({ date: addDays(start, i), goal: 30, reachedAt: `${addDays(start, i)}T08:00:00.000Z` }))
    d.checkIns = [...run('2026-08-01', 5), ...run('2026-08-10', 31)]
    const e = earnedOf(d)
    expect(e.seven).toBe('2026-08-16T08:00:00.000Z')
    expect(e.thirty).toBe('2026-09-08T08:00:00.000Z')
    d.checkIns = run('2026-08-01', 6)
    expect(earnedOf(d).seven).toBeUndefined()
  })

  it('全：64 卦都在看圖題答對過，取第 64 卦的時間', () => {
    const d = empty()
    const m = (n: number, at: string, facet: Mastery['facet'] = 'image'): Mastery => ({ id: `${n}:${facet}`, hexagram: n, facet, firstCorrectAt: at })
    d.mastery = [...Array.from({ length: 63 }, (_, i) => m(i + 1, T(1))), m(64, T(1), 'glyph')]
    expect(earnedOf(d).all64).toBeUndefined()
    d.mastery.push(m(64, T(9)))
    expect(earnedOf(d).all64).toBe(T(9))
  })

  it('溫：第 10 筆溫故 XP 的時間', () => {
    const d = empty()
    const ev = (i: number): XpEvent => ({ id: `r${i}`, key: `review:s${i}`, at: T(i + 1), date: '2026-10-01', amount: 10, source: 'review', ref: '' })
    d.xpEvents = Array.from({ length: 9 }, (_, i) => ev(i))
    expect(earnedOf(d).review10).toBeUndefined()
    d.xpEvents.push(ev(9))
    expect(earnedOf(d).review10).toBe(T(10))
  })

  it('筮：最早一則大衍筮法的占卜，刪除的不算', () => {
    const d = empty()
    d.readings = [reading({ method: 'coins', createdAt: T(1) }), reading({ method: 'yarrow-hand', createdAt: T(8), deletedAt: T(9) }), reading({ method: 'yarrow-quick', createdAt: T(12) })]
    expect(earnedOf(d).yarrow).toBe(T(12))
  })

  it('錄：第 10 則事後回顧的時間', () => {
    const d = empty()
    d.readings = Array.from({ length: 10 }, (_, i) => reading({ followUp: { text: '回顧', writtenAt: T(i + 1) } }))
    expect(earnedOf(d).journal10).toBe(T(10))
    d.readings.pop()
    expect(earnedOf(d).journal10).toBeUndefined()
  })
})

describe('功能開關與「溫」印', () => {
  const saved = FLAGS.review
  afterEach(() => { FLAGS.review = saved })

  it('溫故關閉時印譜只列 14 枚、不通知「溫」印，判定照常', () => {
    FLAGS.review = false
    expect(shownSeals()).toHaveLength(14)
    expect(isSealShown('review10')).toBe(false)
    expect(isSealShown('yarrow')).toBe(true)
    const d = empty()
    d.xpEvents = Array.from({ length: 10 }, (_, i): XpEvent => ({ id: `r${i}`, key: `review:s${i}`, at: T(i + 1), date: '2026-10-01', amount: 10, source: 'review', ref: '' }))
    expect(earnedOf(d).review10).toBe(T(10))
  })

  it('溫故打開時 15 枚全部列出', () => {
    FLAGS.review = true
    expect(shownSeals()).toHaveLength(15)
    expect(isSealShown('review10')).toBe(true)
  })
})
