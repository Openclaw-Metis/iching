// 維護工作：持久保存申請、清除全部資料、重設學堂進度、各資料表筆數（診斷資訊）。

import { requireDb } from '../connection.ts'
import { TABLE_NAMES, type TableName } from '../db.ts'
import { DIVINATION_SEALS } from './seals.ts'
import * as settings from './settings.ts'

/** 第一次成功保存紀錄後申請持久保存；只申請一次，被拒不重試 */
export async function requestPersist(): Promise<boolean | null> {
  if (await settings.get('persistAsked')) return null
  const storage = globalThis.navigator?.storage
  const granted = storage?.persist ? await storage.persist().catch(() => false) : false
  await settings.set('persistAsked', true)
  return granted
}

export async function tableCounts(): Promise<Record<TableName, number>> {
  const db = await requireDb()
  const counts = await Promise.all(TABLE_NAMES.map(t => db.table(t).count()))
  return Object.fromEntries(TABLE_NAMES.map((t, i) => [t, counts[i]])) as Record<TableName, number>
}

/** 清除全部使用者資料，回到首次使用狀態；中繼資料（安裝識別碼與資料表版本）保留 */
export async function clearAll() {
  const db = await requireDb()
  const tables = TABLE_NAMES.filter(t => t !== 'meta').map(t => db.table(t))
  await db.transaction('rw', tables, async () => {
    for (const t of tables) await t.clear()
  })
  await settings.ensureDefaults()
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('iching:') && key !== 'iching:errors') localStorage.removeItem(key)
  } catch { /* 介面偏好清不掉也不影響資料 */ }
}

/**
 * 重設學堂進度：清掉課程、作答、考核、溫故、掌握、XP、打卡與學堂相關印章。
 * 占卜紀錄、今日卦、收藏與「筮」「錄」兩枚印章不動。
 */
export async function resetAcademy() {
  const db = await requireDb()
  const tables = [db.lessonProgress, db.attempts, db.examResults, db.reviewCards, db.reviewLogs, db.mastery, db.xpEvents, db.checkIns]
  await db.transaction('rw', [...tables, db.seals], async () => {
    for (const t of tables) await t.clear()
    await db.seals.filter(s => !DIVINATION_SEALS.includes(s.id)).delete()
  })
}
