// 溫故卡與作答紀錄（規格「溫故與學習地圖」）。這裡只存取資料，FSRS 的排程計算在 features/review，
// 保存層不載入 ts-fsrs。移出溫故只標記 removedAt，之後不會被自動建回。

import { AppError, isQuotaError } from '../../lib/errors.ts'
import { requireDb } from '../connection.ts'
import type { Facet, IchingDB, ReviewCard, ReviewLog } from '../db.ts'

export const cardId = (hexagram: number, facet: Facet) => `${hexagram}:${facet}`

const rethrow = (e: unknown): never => {
  if (isQuotaError(e)) throw new AppError('STORAGE_QUOTA', undefined, { cause: e })
  throw e
}

export async function get(id: string): Promise<ReviewCard | undefined> {
  const db = await requireDb()
  return db.reviewCards.get(id)
}

/** 卡不存在時才建立（移出過的卡也算存在）；回傳是否新建 */
export async function createIfAbsent(card: ReviewCard): Promise<boolean> {
  const db = await requireDb()
  return db.transaction('rw', db.reviewCards, async () => {
    if (await db.reviewCards.get(card.id)) return false
    await db.reviewCards.add(card)
    return true
  }).catch(rethrow)
}

/** 作答後寫回排程結果並留一筆作答紀錄，同一個交易 */
export async function saveGraded(card: ReviewCard, log: ReviewLog): Promise<void> {
  const db = await requireDb()
  await db.transaction('rw', db.reviewCards, db.reviewLogs, async () => {
    await db.reviewCards.put(card)
    await db.reviewLogs.add(log)
  }).catch(rethrow)
}

export async function put(card: ReviewCard): Promise<void> {
  const db = await requireDb()
  await db.reviewCards.put(card).catch(rethrow)
}

/** 未移出且已到期的卡，依到期時間排序 */
export async function dueCards(db: IchingDB, now: Date, limit = Infinity): Promise<ReviewCard[]> {
  const cards = await db.reviewCards.where('due').belowOrEqual(now.toISOString()).sortBy('due')
  return cards.filter(c => !c.removedAt).slice(0, limit)
}

/** 「待溫 N 張」：未移出且已到期 */
export async function dueCount(db: IchingDB, now = new Date()): Promise<number> {
  return db.reviewCards.where('due').belowOrEqual(now.toISOString()).filter(c => !c.removedAt).count()
}

export const allOf = (db: IchingDB) => db.reviewCards.toArray()
export const ofHexagram = (db: IchingDB, hexagram: number) => db.reviewCards.where('hexagram').equals(hexagram).toArray()
