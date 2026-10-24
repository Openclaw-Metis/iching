// 給畫面用的訂閱：useLiveQuery 讓另一個分頁修改後畫面自動更新；記憶體替代模式也是同一個 Dexie，訂閱照常觸發。

import { useEffect, useState, useSyncExternalStore } from 'react'
import { currentStorageMode, requireDb, subscribeStorageMode } from './connection.ts'
import type { IchingDB } from './db.ts'

export { useLiveQuery } from 'dexie-react-hooks'

/** 可寫入的資料庫；還在開啟或不能寫入時為 null */
export function useDb(): IchingDB | null {
  const [db, setDb] = useState<IchingDB | null>(null)
  useEffect(() => {
    let alive = true
    requireDb().then(d => { if (alive) setDb(d) }, () => {})
    return () => { alive = false }
  }, [])
  return db
}

export const useStorageMode = () => useSyncExternalStore(subscribeStorageMode, currentStorageMode, currentStorageMode)
