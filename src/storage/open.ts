// 開啟資料庫並依錯誤種類決定怎麼處理（規格「State 管理與持久化：恢復流程」）。
// 只有 IndexedDB 根本不能用時才改用記憶體資料庫；版本比程式新或升級失敗時停止寫入，
// 不能退回記憶體，否則使用者會在空白資料上繼續操作，以為紀錄不見了。

import { createDb, type IchingDB } from './db.ts'
import { logError } from './diagnostics.ts'
import { createMemoryDb } from './memory.ts'

export type StorageMode = 'indexeddb' | 'memory' | 'version-error' | 'upgrade-failed' | 'blocked' | 'stale'

export interface StorageHandle {
  /** 不能寫入的狀態（版本錯誤、升級失敗、分頁過期）為 null 或已關閉 */
  db: IchingDB | null
  mode: StorageMode
}

export interface OpenOptions {
  /** 測試時注入 fake-indexeddb；傳 null 代表這個瀏覽器沒有 IndexedDB */
  indexedDB?: IDBFactory | null
  IDBKeyRange?: typeof IDBKeyRange
  /** 開啟過程與之後的狀態變化：blocked（等待其他分頁）、indexeddb（開啟完成）、stale（另一個分頁已升級） */
  onStatus?: (mode: StorageMode) => void
}

// 隱私模式或被瀏覽器封鎖時的錯誤；Dexie 有時把原始錯誤放在 inner
const UNAVAILABLE = new Set(['MissingAPIError', 'SecurityError', 'InvalidStateError'])
const errorNames = (e: unknown) => [(e as { name?: string })?.name, (e as { inner?: { name?: string } })?.inner?.name]

export async function openStorage(options: OpenOptions = {}): Promise<StorageHandle> {
  const factory = 'indexedDB' in options ? options.indexedDB : globalThis.indexedDB
  const report = options.onStatus ?? (() => {})
  if (!factory) return fallBackToMemory('IndexedDB 不存在')

  const db = createDb({ indexedDB: guard(factory), IDBKeyRange: options.IDBKeyRange ?? globalThis.IDBKeyRange })
  const handle: StorageHandle = { db, mode: 'indexeddb' }

  db.on('blocked', () => {
    logError('STORAGE_BLOCKED', '升級被其他分頁的舊版連線擋住')
    report('blocked')
  })
  // 另一個分頁要升級：關閉自己的連線並停用自動重開，這個分頁之後不再寫入。
  // 回傳 false 讓 Dexie 預設的處理（關閉後允許自動重開）不再執行
  db.on('versionchange', () => {
    db.close({ disableAutoOpen: true })
    handle.mode = 'stale'
    logError('STORAGE_STALE_TAB', '另一個分頁已升級資料庫')
    report('stale')
    return false
  })

  try {
    await db.open()
  } catch (e) {
    const names = errorNames(e)
    if (names.includes('VersionError')) return refuse(db, 'version-error', e)
    if (names.some(n => n && UNAVAILABLE.has(n))) return fallBackToMemory(names.find(Boolean) ?? 'unknown')
    return refuse(db, 'upgrade-failed', e)
  }

  report('indexeddb')
  return handle
}

// Dexie 遇到 VersionError 會改用不指定版本號重開，接著發現資料表和程式宣告的不同，就自行補建資料表並把版本號加一，
// 等於舊程式改寫了新版的資料庫。這裡攔下不指定版本號的開啟，讓 VersionError 原樣傳回
function guard(factory: IDBFactory): IDBFactory {
  return {
    open: (name: string, version?: number) => {
      if (version === undefined) throw new DOMException('資料庫版本比程式新', 'VersionError')
      return factory.open(name, version)
    },
    deleteDatabase: (name: string) => factory.deleteDatabase(name),
    cmp: (a: unknown, b: unknown) => factory.cmp(a, b),
    databases: factory.databases ? () => factory.databases() : undefined,
  } as IDBFactory
}

function refuse(db: IchingDB, mode: 'version-error' | 'upgrade-failed', cause?: unknown): StorageHandle {
  db.close({ disableAutoOpen: true })
  logError(mode === 'version-error' ? 'STORAGE_VERSION' : 'STORAGE_UPGRADE_FAILED', String((cause as Error)?.message ?? '資料庫版本比程式新'))
  return { db: null, mode }
}

async function fallBackToMemory(reason: string): Promise<StorageHandle> {
  logError('STORAGE_UNAVAILABLE', reason)
  return { db: await createMemoryDb(), mode: 'memory' }
}
