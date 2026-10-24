// 印章：存在即已取得，取得時間採實際達成的時間（規格「印譜」）。判定在 features/academy/seals.ts。

import { requireDb } from '../connection.ts'
import type { IchingDB, Seal, SealId } from '../db.ts'

/** 學堂重設時保留的印章：與占卜紀錄相關 */
export const DIVINATION_SEALS: SealId[] = ['yarrow', 'journal10']

/** 沒有的才寫入；回傳這次新取得的 */
export async function grant(earned: Seal[]): Promise<SealId[]> {
  if (!earned.length) return []
  const db = await requireDb()
  return db.transaction('rw', db.seals, async () => {
    const added: SealId[] = []
    for (const s of earned) {
      if (await db.seals.get(s.id)) continue
      await db.seals.add(s)
      added.push(s.id)
    }
    return added
  })
}

export const allOf = (db: IchingDB) => db.seals.toArray()
