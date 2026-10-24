// 掌握紀錄：第一次答對卦畫認卦或看圖認卦時寫入，學習地圖與「全」印依此判定。

import { requireDb } from '../connection.ts'
import type { Facet, Mastery } from '../db.ts'

export const masteryId = (hexagram: number, facet: Facet) => `${hexagram}:${facet}`

/** 第一次答對卦畫認卦或看圖認卦時寫入；已存在就保留較早的時間。回傳是否新增 */
export async function markMastery(hexagram: number, facet: Facet, now = new Date()): Promise<boolean> {
  const db = await requireDb()
  const id = masteryId(hexagram, facet)
  return db.transaction('rw', db.mastery, async () => {
    if (await db.mastery.get(id)) return false
    const row: Mastery = { id, hexagram, facet, firstCorrectAt: now.toISOString() }
    await db.mastery.add(row)
    return true
  })
}
