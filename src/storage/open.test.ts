import { Dexie, liveQuery } from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { isAppError } from '../lib/errors.ts'
import { DB_NAME, nativeVersion, SCHEMA_VERSION } from './db.ts'
import { provideStorage, requireDb } from './connection.ts'
import { openStorage, type StorageMode } from './open.ts'

// 測試用：以原生 API 開一個連線，可選擇在 upgrade 時建立資料表
function rawOpen(factory: IDBFactory, version: number, upgrade?: (db: IDBDatabase) => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, version)
    req.onupgradeneeded = () => upgrade?.(req.result)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

describe('openStorage', () => {
  it('正常開啟時為 indexeddb', async () => {
    const h = await openStorage({ indexedDB: new IDBFactory(), IDBKeyRange })
    expect(h.mode).toBe('indexeddb')
    expect(h.db?.isOpen()).toBe(true)
  })

  it('資料庫版本比程式新時為 version-error，不改用記憶體、拒絕寫入（AC-28、TC-21）', async () => {
    const factory = new IDBFactory()
    // 模擬較新版的程式：同一個資料庫升到 version 2，多一張表
    const newer = new Dexie(DB_NAME, { indexedDB: factory, IDBKeyRange })
    newer.version(1).stores({ readings: 'id', meta: 'key' })
    newer.version(2).stores({ readings: 'id', meta: 'key', futureTable: 'id' })
    await newer.open()
    await newer.table('readings').add({ id: 'from-newer' })
    newer.close()

    const h = await openStorage({ indexedDB: factory, IDBKeyRange })
    expect(h.mode).toBe('version-error')
    expect(h.db).toBeNull()

    provideStorage(h)
    await expect(requireDb()).rejects.toSatisfy(e => isAppError(e, 'STORAGE_VERSION'))

    // 資料庫維持較新版的樣子，沒有被舊程式改動
    const check = await rawOpen(factory, nativeVersion(2))
    expect([...check.objectStoreNames]).toContain('futureTable')
    check.close()
  })

  it('升級失敗時為 upgrade-failed，不改用記憶體', async () => {
    const factory = new IDBFactory()
    // 舊的、非本程式建立的同名資料表，主鍵不同，Dexie 無法升級
    const old = await rawOpen(factory, 5, db => db.createObjectStore('readings', { keyPath: 'foo' }))
    old.close()
    const h = await openStorage({ indexedDB: factory, IDBKeyRange })
    expect(h.mode).toBe('upgrade-failed')
    expect(h.db).toBeNull()
  })

  it('IndexedDB 開啟時拋出 SecurityError 會改用記憶體資料庫，liveQuery 在寫入後發出新值（TC-22）', async () => {
    const blocked = { open() { throw new DOMException('The operation is insecure.', 'SecurityError') } } as unknown as IDBFactory
    const h = await openStorage({ indexedDB: blocked, IDBKeyRange })
    expect(h.mode).toBe('memory')
    const db = h.db!

    const seen: number[] = []
    const sub = liveQuery(() => db.favorites.count()).subscribe(n => seen.push(n))
    await new Promise(r => setTimeout(r, 30))
    await db.favorites.add({ hexagram: 29, addedAt: new Date().toISOString() })
    await new Promise(r => setTimeout(r, 30))
    sub.unsubscribe()
    expect(seen[0]).toBe(0)
    expect(seen.at(-1)).toBe(1)
  })

  it('沒有 IndexedDB 時改用記憶體資料庫', async () => {
    const h = await openStorage({ indexedDB: null })
    expect(h.mode).toBe('memory')
    expect(await h.db!.meta.get('install')).toMatchObject({ schema: SCHEMA_VERSION })
  })

  it('升級被舊分頁擋住時回報 blocked，舊連線關閉後自動繼續', async () => {
    const factory = new IDBFactory()
    // 舊版分頁的連線：收到 versionchange 也不關閉
    const old = await rawOpen(factory, 5)
    const statuses: StorageMode[] = []
    const opening = openStorage({ indexedDB: factory, IDBKeyRange, onStatus: m => statuses.push(m) })
    await new Promise(r => setTimeout(r, 50))
    expect(statuses).toContain('blocked')
    old.close()
    const h = await opening
    expect(h.mode).toBe('indexeddb')
    expect(statuses.at(-1)).toBe('indexeddb')
  })

  it('另一個分頁升級時，這個分頁關閉連線並標記 stale，之後不再寫入', async () => {
    const factory = new IDBFactory()
    const statuses: StorageMode[] = []
    const h = await openStorage({ indexedDB: factory, IDBKeyRange, onStatus: m => statuses.push(m) })
    const newer = new Dexie(DB_NAME, { indexedDB: factory, IDBKeyRange })
    newer.version(2).stores({ futureTable: 'id' })
    await newer.open()
    expect(statuses).toContain('stale')
    expect(h.mode).toBe('stale')
    expect(h.db!.isOpen()).toBe(false)
    await expect(h.db!.favorites.add({ hexagram: 1, addedAt: '' })).rejects.toBeTruthy()
    newer.close()
  })
})
