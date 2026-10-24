import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { provideStorage, requireDb } from '../connection.ts'
import { openStorage } from '../open.ts'
import * as settings from './settings.ts'
import * as xp from './xp.ts'

beforeEach(async () => provideStorage(await openStorage({ indexedDB: new IDBFactory(), IDBKeyRange })))

// 用本地時間建構，測試結果不受執行環境時區影響
const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h)
const DAY = at(2026, 10, 24)
const answer = (i: number, now = DAY) => xp.award({ key: `answer:a1:${i}`, source: 'answer', amount: xp.XP_AMOUNTS.answer, ref: 'a1' }, now)

describe('xp.award', () => {
  it('同一個業務鍵只記一次', async () => {
    const input = { key: 'daily:2026-10-24', source: 'daily' as const, amount: xp.XP_AMOUNTS.daily }
    expect(await xp.award(input, DAY)).toEqual({ awarded: 5, capped: false })
    expect(await xp.award(input, DAY)).toEqual({ awarded: 0, capped: false })
    expect(await (await requireDb()).xpEvents.count()).toBe(1)
  })

  it('兩個分頁同時給同一個鍵也只留一筆', async () => {
    const input = { key: 'lesson:S1-L1', source: 'lesson' as const, amount: xp.XP_AMOUNTS.lesson }
    const results = await Promise.all([xp.award(input, DAY), xp.award(input, DAY)])
    expect(results.map(r => r.awarded).sort()).toEqual([0, 10])
  })

  it('當天作答 XP 達 100 後不再寫入，隔天重新計算', async () => {
    for (let i = 0; i < 50; i++) expect((await answer(i)).awarded).toBe(2)
    expect(await answer(50)).toEqual({ awarded: 0, capped: true })
    expect((await xp.summary(DAY)).today).toBe(100)
    // 其他來源不受作答上限影響
    expect((await xp.award({ key: 'lesson:S1-L1', source: 'lesson', amount: 10 }, DAY)).awarded).toBe(10)
    expect((await answer(51, at(2026, 10, 25))).awarded).toBe(2)
  })

  it('匯入另一台裝置同日的 60 筆作答事件後，當天作答 XP 仍以 100 計（TC-09）', async () => {
    const db = await requireDb()
    await db.xpEvents.bulkAdd(Array.from({ length: 60 }, (_, i) => ({
      id: crypto.randomUUID(), key: `answer:other:${i}`, at: DAY.toISOString(), date: '2026-10-24', amount: 2, source: 'answer' as const, ref: 'other',
    })))
    await xp.award({ key: 'daily:2026-10-24', source: 'daily', amount: 5 }, DAY)
    const s = await xp.summary(DAY)
    expect(s.today).toBe(105)
    expect(s.total).toBe(105)
    expect(await answer(0)).toEqual({ awarded: 0, capped: true })
  })

  it('溫故每天最多 3 輪', async () => {
    const review = (id: string, now = DAY) => xp.award({ key: `review:${id}`, source: 'review', amount: xp.XP_AMOUNTS.review }, now)
    for (const id of ['r1', 'r2', 'r3']) expect((await review(id)).awarded).toBe(10)
    expect(await review('r4')).toEqual({ awarded: 0, capped: true })
    expect((await review('r5', at(2026, 10, 25))).awarded).toBe(10)
  })

  it('當天 XP 第一次達到每日目標時寫入一筆打卡，之後改目標不影響', async () => {
    const db = await requireDb()
    for (let i = 0; i < 14; i++) await answer(i)
    expect(await db.checkIns.count()).toBe(0)
    await answer(14) // 30 XP，達到預設目標 30
    expect(await db.checkIns.toArray()).toEqual([{ date: '2026-10-24', goal: 30, reachedAt: DAY.toISOString() }])
    await answer(15)
    await settings.set('dailyGoal', 50)
    await answer(16)
    expect(await db.checkIns.toArray()).toEqual([{ date: '2026-10-24', goal: 30, reachedAt: DAY.toISOString() }])
  })

  it('目標調低後補做打卡檢查', async () => {
    const db = await requireDb()
    for (let i = 0; i < 12; i++) await answer(i)
    expect(await xp.ensureCheckIn(DAY)).toBeUndefined()
    await settings.set('dailyGoal', 20)
    expect(await xp.ensureCheckIn(DAY)).toMatchObject({ date: '2026-10-24', goal: 20 })
    expect(await db.checkIns.count()).toBe(1)
  })
})

describe('連續天數', () => {
  it('跨月、跨年連續；今天還沒達標時從昨天算起', () => {
    const dates = ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02']
    expect(xp.streaks(dates, '2026-01-02')).toEqual({ streak: 4, best: 4 })
    expect(xp.streaks(dates, '2026-01-03')).toEqual({ streak: 4, best: 4 })
    expect(xp.streaks(['2026-02-28', '2026-03-01'], '2026-03-01').streak).toBe(2)
  })

  it('中斷一天後歸零，最長連續天數保留', () => {
    const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05']
    expect(xp.streaks(dates, '2026-10-05')).toEqual({ streak: 1, best: 3 })
    expect(xp.streaks(dates, '2026-10-07')).toEqual({ streak: 0, best: 3 })
    expect(xp.streaks([], '2026-10-07')).toEqual({ streak: 0, best: 0 })
  })

  it('summary 由打卡紀錄算出連續天數', async () => {
    const db = await requireDb()
    await db.checkIns.bulkAdd(['2026-10-22', '2026-10-23'].map(date => ({ date, goal: 30, reachedAt: DAY.toISOString() })))
    expect(await xp.summary(DAY)).toMatchObject({ today: 0, total: 0, goal: 30, streak: 2, best: 2 })
  })
})
