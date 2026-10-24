// 中繼資料：資料表版本、安裝識別碼與建立時間。不匯出，只用於診斷與升級。

import { requireDb } from '../connection.ts'
import type { Meta } from '../db.ts'

export async function get(): Promise<Meta | undefined> {
  const db = await requireDb()
  return db.meta.get('install')
}
