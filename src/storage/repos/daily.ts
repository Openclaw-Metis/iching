// 今日一卦：以本地日期為主鍵，當天第一次翻開時以 add() 建立。
// 兩個分頁同時翻開時，後到的那個主鍵衝突，改回傳先寫入的那一筆，所以一天只會有一卦。

import { localDateKey } from '../../lib/dates.ts'
import { AppError, isQuotaError } from '../../lib/errors.ts'
import { randomInt } from '../../lib/rng.ts'
import { requireDb } from '../connection.ts'
import type { DailyDraw, IchingDB } from '../db.ts'

export const NOTE_MAX = 500

const isConstraint = (e: unknown) =>
  [(e as { name?: string })?.name, (e as { inner?: { name?: string } })?.inner?.name].includes('ConstraintError')

export async function today(now = new Date()): Promise<DailyDraw | undefined> {
  const db = await requireDb()
  return db.dailyDraws.get(localDateKey(now))
}

/** 抽今天的卦；已經抽過就回傳既有那一筆。pick 只供測試注入 */
export async function draw(now = new Date(), pick: () => number = () => randomInt(1, 64)): Promise<DailyDraw> {
  const db = await requireDb()
  const at = now.toISOString()
  const row: DailyDraw = { date: localDateKey(now), hexagram: pick(), drawnAt: at, note: '', updatedAt: at, rev: 1 }
  try {
    await db.dailyDraws.add(row)
    return row
  } catch (e) {
    if (isConstraint(e)) {
      const existing = await db.dailyDraws.get(row.date)
      if (existing) return existing
    }
    if (isQuotaError(e)) throw new AppError('STORAGE_QUOTA', undefined, { cause: e })
    throw e
  }
}

/** 寫心得；expectedRev 與資料庫不同時拋出 WRITE_CONFLICT。回傳新的 rev */
export async function saveNote(date: string, text: string, expectedRev: number, now = new Date()): Promise<number> {
  if ([...text].length > NOTE_MAX) throw new RangeError(`心得最多 ${NOTE_MAX} 字`)
  const db = await requireDb()
  return db.transaction('rw', db.dailyDraws, async () => {
    const current = await db.dailyDraws.get(date)
    if (!current || current.rev !== expectedRev) throw new AppError('WRITE_CONFLICT')
    const rev = current.rev + 1
    await db.dailyDraws.put({ ...current, note: text, updatedAt: now.toISOString(), rev })
    return rev
  }).catch(e => {
    if (isQuotaError(e)) throw new AppError('STORAGE_QUOTA', undefined, { cause: e })
    throw e
  })
}

/** 刪除單日；當天刪除後可以重抽（XP 以日期為鍵，不會再給一次） */
export async function remove(date: string): Promise<void> {
  const db = await requireDb()
  await db.dailyDraws.delete(date)
}

/** 依日期倒序；給 useLiveQuery 直接用 */
export const listOf = (db: IchingDB, limit: number) => db.dailyDraws.orderBy('date').reverse().limit(limit).toArray()
