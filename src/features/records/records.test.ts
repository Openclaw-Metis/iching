import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { isAppError } from '../../lib/errors.ts'
import { openStorage, provideStorage, readings, requireDb, type Reading } from '../../storage/index.ts'

beforeEach(async () => provideStorage(await openStorage({ indexedDB: new IDBFactory(), IDBKeyRange })))

let seq = 0
function reading(over: Partial<Reading> = {}): Reading {
  const at = over.createdAt ?? new Date(Date.UTC(2026, 9, 1, 0, 0, seq++)).toISOString()
  return {
    id: crypto.randomUUID(), createdAt: at, updatedAt: at, rev: 1, question: '要不要接下新的專案？', category: 'career', method: 'coins',
    lines: [7, 6, 8, 8, 7, 8], primary: 3, result: 60, moving: [1], note: '', followUp: null, starred: 0, v: 1, deletedAt: null, ...over,
  }
}

async function seed(rows: Reading[]) {
  await (await requireDb()).readings.bulkAdd(rows)
  return rows
}

describe('占卜紀錄', () => {
  it('軟刪除後列表隱藏，復原後回到原位置（AC-10）', async () => {
    const [a, b, c] = await seed([reading(), reading(), reading()])
    const deleted = await readings.softDelete(b.id, 1)
    expect((await readings.list()).items.map(r => r.id)).toEqual([c.id, a.id])
    await readings.restore(b.id, deleted.rev)
    expect((await readings.list()).items.map(r => r.id)).toEqual([c.id, b.id, a.id])
  })

  it('軟刪除 10 秒後永久刪除，未滿 10 秒或已復原的不刪', async () => {
    const [a, b] = await seed([reading(), reading()])
    const t0 = new Date('2026-10-24T00:00:00Z')
    await readings.softDelete(a.id, 1, t0)
    const bDeleted = await readings.softDelete(b.id, 1, t0)
    await readings.restore(b.id, bDeleted.rev, new Date(t0.getTime() + 3000))
    expect(await readings.purgeDeleted(new Date(t0.getTime() + 9000))).toBe(0)
    expect(await readings.purgeDeleted(new Date(t0.getTime() + 10_000))).toBe(1)
    const db = await requireDb()
    expect(await db.readings.get(a.id)).toBeUndefined()
    expect(await db.readings.get(b.id)).toBeDefined()
  })

  it('兩個帶相同 rev 的 update 同時發出只有一個成功（AC-29）；softDelete 也比對 rev', async () => {
    const [a] = await seed([reading()])
    const results = await Promise.allSettled([
      readings.update(a.id, { note: '甲' }, 1),
      readings.update(a.id, { note: '乙' }, 1),
    ])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    await expect(readings.softDelete(a.id, 1)).rejects.toSatisfy(e => isAppError(e, 'WRITE_CONFLICT'))
  })

  it('篩選後的分頁不會出現空頁', async () => {
    // 120 筆中只有 50 筆加星號：第一頁剛好 50 筆，不該再給下一頁
    const rows = Array.from({ length: 120 }, (_, i) => reading({ starred: i % 12 < 5 ? 1 : 0 }))
    await seed(rows)
    const first = await readings.list({ starred: true })
    expect(first.items).toHaveLength(50)
    expect(first.next).toBeUndefined()
    const all = await readings.list()
    expect(all.items).toHaveLength(50)
    expect(all.next).toBeDefined()
    const second = await readings.list({}, { before: all.next })
    const third = await readings.list({}, { before: second.next })
    expect(third.items).toHaveLength(20)
    expect(third.next).toBeUndefined()
    expect(new Set([...all.items, ...second.items, ...third.items].map(r => r.id)).size).toBe(120)
  })

  it('同一毫秒建立的多筆紀錄都會列出', async () => {
    const at = '2026-10-24T01:02:03.004Z'
    const rows = await seed(Array.from({ length: 60 }, () => reading({ createdAt: at, updatedAt: at })))
    const p1 = await readings.list()
    const p2 = await readings.list({}, { before: p1.next })
    expect(new Set([...p1.items, ...p2.items].map(r => r.id))).toEqual(new Set(rows.map(r => r.id)))
  })

  it('搜尋問題、筆記與事後回顧；依方法、類別、是否回顧篩選', async () => {
    await seed([
      reading({ question: '要不要搬家？' }),
      reading({ note: '想先找房仲', method: 'manual' }),
      reading({ followUp: { text: '後來決定搬了', writtenAt: '2026-10-20T00:00:00Z' }, category: 'decision' }),
    ])
    expect((await readings.list({ query: '搬' })).items).toHaveLength(2)
    expect((await readings.list({ query: '房仲' })).items).toHaveLength(1)
    expect((await readings.list({ method: 'manual' })).items).toHaveLength(1)
    expect((await readings.list({ reviewed: true })).items[0].category).toBe('decision')
    expect((await readings.list({ reviewed: false })).items).toHaveLength(2)
  })
})
