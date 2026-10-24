// 收藏卦牌：存在即收藏，再點一次就刪除。

import { requireDb } from '../connection.ts'
import type { Favorite, IchingDB } from '../db.ts'

/** 切換收藏；回傳切換後是否為收藏 */
export async function toggle(hexagram: number, now = new Date()): Promise<boolean> {
  const db = await requireDb()
  return db.transaction('rw', db.favorites, async () => {
    if (await db.favorites.get(hexagram)) {
      await db.favorites.delete(hexagram)
      return false
    }
    await db.favorites.add({ hexagram, addedAt: now.toISOString() })
    return true
  })
}

/** 依加入時間，新的在前 */
export const listOf = (db: IchingDB): Promise<Favorite[]> => db.favorites.orderBy('addedAt').reverse().toArray()
export const hasOf = async (db: IchingDB, hexagram: number) => Boolean(await db.favorites.get(hexagram))
