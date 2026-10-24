import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { addDays } from '../../lib/dates.ts'
import { openStorage, provideStorage, requireDb, settings, xp, type CheckIn } from '../../storage/index.ts'
import { firstRunReached, streakOf } from './streak.ts'

beforeEach(async () => provideStorage(await openStorage({ indexedDB: new IDBFactory(), IDBKeyRange })))

const run = (start: string, days: number, goal = 30): CheckIn[] =>
  Array.from({ length: days }, (_, i) => ({ date: addDays(start, i), goal, reachedAt: `${addDays(start, i)}T12:00:00.000Z` }))

describe('連續天數（AC-16）', () => {
  it('連續 30 天，第 31 天沒有：第 30 天為 30，第 32 天開啟時為 0，最長仍為 30（TC-07）', () => {
    const c = run('2026-09-01', 30) // 9/1 到 9/30
    expect(streakOf(c, '2026-09-30')).toEqual({ streak: 30, best: 30 })
    expect(streakOf(c, '2026-10-02')).toEqual({ streak: 0, best: 30 })
  })

  it('連續 30 天', () => {
    const c = run('2026-09-25', 30)
    expect(streakOf(c, '2026-10-24')).toEqual({ streak: 30, best: 30 })
    expect(firstRunReached(c, 30)).toBe('2026-10-24T12:00:00.000Z')
    expect(firstRunReached(c, 7)).toBe('2026-10-01T12:00:00.000Z')
  })

  it('跨年、跨月與閏年二月', () => {
    expect(streakOf(run('2026-12-28', 7), '2027-01-03')).toEqual({ streak: 7, best: 7 })
    expect(streakOf(run('2028-02-27', 4), '2028-03-01')).toEqual({ streak: 4, best: 4 })
  })

  it('今天還沒達標從昨天算；中斷一天歸零', () => {
    const c = run('2026-10-20', 4) // 20 到 23 日
    expect(streakOf(c, '2026-10-24').streak).toBe(4)
    expect(streakOf(c, '2026-10-25')).toEqual({ streak: 0, best: 4 })
    expect(firstRunReached([...run('2026-10-01', 6), ...run('2026-10-08', 7)], 7)).toBe('2026-10-14T12:00:00.000Z')
  })

  it('改每日目標不影響過去的打卡', async () => {
    const db = await requireDb()
    await db.checkIns.bulkAdd(run('2026-10-21', 3, 30))
    await settings.set('dailyGoal', 50)
    const s = await xp.summary(new Date(2026, 9, 24, 9))
    expect(s).toMatchObject({ goal: 50, streak: 3, best: 3 })
    expect((await db.checkIns.toArray()).every(c => c.goal === 30)).toBe(true)
  })
})
