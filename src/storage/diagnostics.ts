// 診斷資訊：網站不蒐集使用數據，錯誤只記在這台裝置的 localStorage（最多 50 筆，循環覆蓋），
// 使用者回報問題時可以從「書卜 › 設定與備份 › 診斷資訊」複製出來。

import type { ErrorCode } from '../lib/errors.ts'
import type { StorageHandle, StorageMode } from './open.ts'

const KEY = 'iching:errors'
const MAX = 50

export interface ErrorEntry {
  code: ErrorCode | string
  message: string
  path: string
  at: string
}

// localStorage 不能用時（隱私模式、測試環境）退回記憶體，當次仍看得到
let fallback: ErrorEntry[] = []

export function readErrors(): ErrorEntry[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    return raw ? (JSON.parse(raw) as ErrorEntry[]) : fallback
  } catch {
    return fallback
  }
}

export function logError(code: ErrorCode | string, message: string) {
  const entry: ErrorEntry = { code, message, path: globalThis.location?.pathname ?? '', at: new Date().toISOString() }
  const list = [...readErrors(), entry].slice(-MAX)
  fallback = list
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(list)) } catch { /* 寫不進去也不影響操作 */ }
  if (import.meta.env?.DEV) console.warn(`[${code}] ${message}`)
}

export function clearErrors() {
  fallback = []
  try { globalThis.localStorage?.removeItem(KEY) } catch { /* 同上 */ }
}

export interface StorageStatus {
  mode: StorageMode
  persisted: boolean | null
  usage: number | null
  quota: number | null
  schema: number | null
}

export async function storageStatus(handle: StorageHandle): Promise<StorageStatus> {
  const storage = globalThis.navigator?.storage
  const [persisted, estimate, meta] = await Promise.all([
    storage?.persisted?.().catch(() => null) ?? null,
    storage?.estimate?.().catch(() => null) ?? null,
    handle.db?.isOpen() ? handle.db.meta.get('install').catch(() => undefined) : undefined,
  ])
  return {
    mode: handle.mode,
    persisted,
    usage: estimate?.usage ?? null,
    quota: estimate?.quota ?? null,
    schema: meta?.schema ?? null,
  }
}
