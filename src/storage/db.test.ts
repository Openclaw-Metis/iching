import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { createDb, EXPORTED_TABLES, nativeVersion, SCHEMA_VERSION, TABLE_NAMES } from './db.ts'

const fresh = () => createDb({ indexedDB: new IDBFactory(), IDBKeyRange })

describe('資料表（version 1）', () => {
  it('開啟後 16 張表都存在', async () => {
    const db = fresh()
    await db.open()
    expect(TABLE_NAMES).toHaveLength(16)
    expect(db.tables.map(t => t.name).sort()).toEqual([...TABLE_NAMES].sort())
    expect([...db.backendDB().objectStoreNames].sort()).toEqual([...TABLE_NAMES].sort())
    expect(db.backendDB().version).toBe(nativeVersion(SCHEMA_VERSION))
  })

  it('第一次建立時寫入 meta.schema = 1 與 installId', async () => {
    const db = fresh()
    await db.open()
    const meta = await db.meta.get('install')
    expect(meta?.schema).toBe(1)
    expect(meta?.installId).toMatch(/^[0-9a-f-]{36}$/)
    expect(Number.isNaN(Date.parse(meta!.createdAt))).toBe(false)
  })

  it('xpEvents 的 key 是唯一索引，重複時寫入失敗', async () => {
    const db = fresh()
    await db.open()
    const event = { key: 'daily:2026-10-24', at: '2026-10-24T01:00:00.000Z', date: '2026-10-24', amount: 5, source: 'daily' as const, ref: '' }
    await db.xpEvents.add({ id: crypto.randomUUID(), ...event })
    await expect(db.xpEvents.add({ id: crypto.randomUUID(), ...event })).rejects.toMatchObject({ name: 'ConstraintError' })
    expect(await db.xpEvents.count()).toBe(1)
  })

  it('主鍵不是自動編號：沒有給主鍵就不能寫入', async () => {
    const db = fresh()
    await db.open()
    await expect(db.favorites.add({ addedAt: '2026-10-24T00:00:00.000Z' } as never)).rejects.toBeTruthy()
  })

  it('readings 可依 [createdAt+id] 排序，同一時間的多筆都會列出', async () => {
    const db = fresh()
    await db.open()
    const at = '2026-10-24T01:00:00.000Z'
    const base = { createdAt: at, updatedAt: at, rev: 1, question: '測試', category: 'general' as const, method: 'coins' as const, lines: [7, 7, 7, 7, 7, 7] as (7)[], primary: 1, result: 1, moving: [], note: '', followUp: null, starred: 0 as const, v: 1, deletedAt: null }
    await db.readings.bulkAdd([{ id: 'b', ...base }, { id: 'a', ...base }, { id: 'c', ...base, createdAt: '2026-10-25T00:00:00.000Z' }])
    const ids = (await db.readings.orderBy('[createdAt+id]').reverse().toArray()).map(r => r.id)
    expect(ids).toEqual(['c', 'b', 'a'])
  })

  it('會匯出的資料表都在資料表清單內，不含草稿、作答進度與中繼資料', () => {
    for (const t of EXPORTED_TABLES) expect(TABLE_NAMES).toContain(t)
    expect(EXPORTED_TABLES).not.toContain('castDraft')
    expect(EXPORTED_TABLES).not.toContain('attempts')
    expect(EXPORTED_TABLES).not.toContain('meta')
  })
})
