// 整個 App 共用的資料庫連線與目前的保存狀態。repos 由這裡取得可寫入的資料庫。

import { AppError, type ErrorCode } from '../lib/errors.ts'
import type { IchingDB } from './db.ts'
import { openStorage, type StorageHandle, type StorageMode } from './open.ts'

let pending: Promise<StorageHandle> | null = null
let mode: StorageMode | 'opening' = 'opening'
const listeners = new Set<() => void>()

function setMode(next: StorageMode) {
  mode = next
  for (const l of listeners) l()
}

/** 整個 App 共用一個連線；第一次呼叫時開啟 */
export function getStorage(): Promise<StorageHandle> {
  pending ??= openStorage({ onStatus: setMode }).then(h => {
    setMode(h.mode)
    return h
  })
  return pending
}

/** 測試或替代情境：改用指定的連線 */
export function provideStorage(handle: StorageHandle) {
  pending = Promise.resolve(handle)
  setMode(handle.mode)
}

export const currentStorageMode = () => mode

export function subscribeStorageMode(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

const REFUSED: Partial<Record<StorageMode, ErrorCode>> = {
  'version-error': 'STORAGE_VERSION',
  'upgrade-failed': 'STORAGE_UPGRADE_FAILED',
  stale: 'STORAGE_STALE_TAB',
  blocked: 'STORAGE_BLOCKED',
}

/** 取得可讀寫的資料庫；版本錯誤、升級失敗或分頁已過期時拋出 AppError，不會寫入任何資料 */
export async function requireDb(): Promise<IchingDB> {
  const h = await getStorage()
  const refused = REFUSED[h.mode]
  if (refused || !h.db) throw new AppError(refused ?? 'STORAGE_UPGRADE_FAILED')
  return h.db
}
