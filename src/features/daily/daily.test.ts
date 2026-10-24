import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isAppError } from '../../lib/errors.ts'
import { watchDate } from '../../lib/dateWatch.ts'
import { daily, openStorage, provideStorage, requireDb, xp } from '../../storage/index.ts'
import { awardDaily } from './daily.ts'

beforeEach(async () => provideStorage(await openStorage({ indexedDB: new IDBFactory(), IDBKeyRange })))

const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h)
const DAY = at(2026, 10, 24)

describe('今日一卦（AC-11）', () => {
  it('同一天兩次 draw 回同一卦', async () => {
    const first = await daily.draw(DAY, () => 29)
    const second = await daily.draw(at(2026, 10, 24, 23), () => 51)
    expect(first).toMatchObject({ date: '2026-10-24', hexagram: 29, note: '', rev: 1 })
    expect(second).toEqual(first)
    expect(await daily.today(at(2026, 10, 24, 18))).toEqual(first)
  })

  it('兩個 draw 同時發出只留一筆', async () => {
    const [a, b] = await Promise.all([daily.draw(DAY, () => 3), daily.draw(DAY, () => 4)])
    expect(a.hexagram).toBe(b.hexagram)
    expect(await (await requireDb()).dailyDraws.count()).toBe(1)
  })

  it('隔天 draw 產生新紀錄，跨午夜依本地日期', async () => {
    await daily.draw(at(2026, 10, 24, 23), () => 1)
    const next = await daily.draw(at(2026, 10, 25, 0), () => 2)
    expect(next).toMatchObject({ date: '2026-10-25', hexagram: 2 })
    expect(await daily.today(at(2026, 10, 25, 0))).toEqual(next)
    expect(await (await requireDb()).dailyDraws.count()).toBe(2)
  })

  it('remove 後同一天可重抽，但翻開的 XP 每天只給一次', async () => {
    await daily.draw(DAY, () => 10)
    expect((await awardDaily('2026-10-24', DAY)).awarded).toBe(5)
    await daily.remove('2026-10-24')
    expect(await daily.today(DAY)).toBeUndefined()
    expect((await daily.draw(DAY, () => 11)).hexagram).toBe(11)
    expect((await awardDaily('2026-10-24', DAY)).awarded).toBe(0)
    expect((await xp.summary(DAY)).today).toBe(5)
  })

  it('心得比對 rev，最多 500 字', async () => {
    const d = await daily.draw(DAY, () => 5)
    const rev = await daily.saveNote(d.date, '先等一等', d.rev)
    expect(rev).toBe(2)
    expect((await daily.today(DAY))?.note).toBe('先等一等')
    await expect(daily.saveNote(d.date, '另一個分頁的舊版本', d.rev)).rejects.toSatisfy(e => isAppError(e, 'WRITE_CONFLICT'))
    await expect(daily.saveNote(d.date, '字'.repeat(501), rev)).rejects.toThrow(RangeError)
    expect(await daily.saveNote(d.date, '字'.repeat(500), rev)).toBe(3)
  })
})

describe('跨日檢查', () => {
  afterEach(() => vi.useRealTimers())

  const fakeDoc = () => Object.assign(new EventTarget(), { hidden: false })

  it('頁面可見時每 60 秒比對，換日才通知一次', () => {
    vi.useFakeTimers()
    let now = at(2026, 10, 24, 23)
    const changes: string[] = []
    const stop = watchDate(d => changes.push(d), { now: () => now, doc: fakeDoc() })
    vi.advanceTimersByTime(60_000)
    expect(changes).toEqual([])
    now = at(2026, 10, 25, 0)
    vi.advanceTimersByTime(60_000)
    vi.advanceTimersByTime(60_000)
    expect(changes).toEqual(['2026-10-25'])
    stop()
    now = at(2026, 10, 26, 0)
    vi.advanceTimersByTime(120_000)
    expect(changes).toEqual(['2026-10-25'])
  })

  it('隱藏時暫停，回到前景立刻檢查', () => {
    vi.useFakeTimers()
    let now = at(2026, 12, 31, 22)
    const doc = fakeDoc()
    const changes: string[] = []
    const stop = watchDate(d => changes.push(d), { now: () => now, doc })
    doc.hidden = true
    doc.dispatchEvent(new Event('visibilitychange'))
    now = at(2027, 1, 1, 8)
    vi.advanceTimersByTime(600_000)
    expect(changes).toEqual([])
    doc.hidden = false
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(changes).toEqual(['2027-01-01'])
    stop()
  })
})
