// IndexedDB 不能用時（隱私模式、被瀏覽器封鎖）的替代資料庫：同一個 Dexie 結構，底層換成 fake-indexeddb，
// useLiveQuery 照常觸發，畫面不需要另一套更新機制；關閉分頁就消失。只在這種情況才動態載入。

import { Dexie } from 'dexie'
import { createDb, type IchingDB } from './db.ts'

export async function createMemoryDb(): Promise<IchingDB> {
  const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb')
  const factory = new IDBFactory()
  // liveQuery 在全域沒有 indexedDB 時不會執行查詢；瀏覽器完全沒有 IndexedDB 時補上，訂閱才會更新
  if (!Dexie.dependencies.indexedDB) Object.assign(Dexie.dependencies, { indexedDB: factory, IDBKeyRange })
  const db = createDb({ indexedDB: factory, IDBKeyRange })
  await db.open()
  return db
}
