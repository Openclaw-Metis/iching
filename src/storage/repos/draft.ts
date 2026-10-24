// 起卦草稿：只有一筆（key = 'current'）。每次寫入完整草稿，在同一個 readwrite 交易內比對 castId 與 rev：
// 畫面載入時看到的版本與資料庫一致才寫入並把 rev 加一，否則拋出 WRITE_CONFLICT（另一個分頁改過，或已完成、已放棄）。

import { AppError, isQuotaError } from '../../lib/errors.ts'
import { requireDb } from '../connection.ts'
import type { CastDraft } from '../db.ts'

export async function get(): Promise<CastDraft | undefined> {
  const db = await requireDb()
  return db.castDraft.get('current')
}

/**
 * 寫入完整草稿。snapshot.rev 是呼叫端最後看到的版本（新草稿為 0）；回傳寫入後的 rev。
 */
export async function save(snapshot: CastDraft, now = new Date()): Promise<number> {
  const db = await requireDb()
  try {
    return await db.transaction('rw', db.castDraft, async () => {
      const current = await db.castDraft.get('current')
      const matches = current
        ? current.castId === snapshot.castId && current.rev === snapshot.rev
        : snapshot.rev === 0
      if (!matches) throw new AppError('WRITE_CONFLICT')
      const rev = snapshot.rev + 1
      await db.castDraft.put({ ...snapshot, key: 'current', rev, updatedAt: now.toISOString() })
      return rev
    })
  } catch (e) {
    if (isQuotaError(e)) throw new AppError('STORAGE_QUOTA', undefined, { cause: e })
    throw e
  }
}

/** 放棄、再問一事時刪除；指定 castId 時只刪同一次起卦的草稿，不誤刪另一個分頁剛開始的 */
export async function clear(castId?: string): Promise<void> {
  const db = await requireDb()
  await db.transaction('rw', db.castDraft, async () => {
    const current = await db.castDraft.get('current')
    if (current && (castId === undefined || current.castId === castId)) await db.castDraft.delete('current')
  })
}
