// 成就補發（規格「通知與背景執行」）：App 啟動時（首屏顯示後）與匯入完成後執行。
// 依既有資料補發印章，並為答對過、卻沒有溫故卡的面向建立卡；移出過的卡仍存在，所以不會被建回。冪等。

import { requireDb, xp } from '../../storage/index.ts'
import { addFromMastery } from '../review/index.ts'
import { checkSeals } from './seals.ts'

export async function reconcileAchievements(now = new Date()): Promise<{ sealsAdded: number; cardsAdded: number }> {
  const db = await requireDb()
  let cardsAdded = 0
  for (const m of await db.mastery.toArray()) {
    if (await addFromMastery(m.hexagram, m.facet, m.firstCorrectAt)) cardsAdded++
  }
  // 匯入另一台裝置的 XP 後，今天可能已達標卻還沒打卡
  await xp.ensureCheckIn(now)
  const sealsAdded = (await checkSeals()).length
  return { sealsAdded, cardsAdded }
}
