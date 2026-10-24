// App 啟動時、首屏顯示後才執行的背景工作（規格「通知與背景執行」）。這個模組以 import() 載入，
// 它靜態匯入的保存層因此不會進卦殿首屏。

import { logError, readings, requireDb, settings, xp } from '../storage/index.ts'

/** 沒有任何學習或占卜資料時不必補發，也就不用載入學堂與溫故模組（含 ts-fsrs） */
async function hasAchievementData(): Promise<boolean> {
  const db = await requireDb()
  const tables = [db.lessonProgress, db.examResults, db.mastery, db.checkIns, db.xpEvents, db.readings]
  for (const t of tables) if (await t.count()) return true
  return false
}

export async function runStartupTasks() {
  const tasks: [string, () => Promise<unknown>][] = [
    ['STARTUP_DEFAULTS', () => settings.ensureDefaults()],
    // 軟刪除超過 10 秒的紀錄（關閉頁面前來不及清掉的）
    ['STARTUP_PURGE', () => readings.purgeDeleted()],
    // 今天的 XP 已達每日目標卻還沒打卡時補上（例如在另一台裝置累積後匯入）
    ['STARTUP_CHECKIN', () => xp.ensureCheckIn()],
    // 依既有資料補發印章與溫故卡；學堂模組含 ts-fsrs，到這裡才載入
    ['STARTUP_RECONCILE', async () => {
      if (await hasAchievementData()) await (await import('../features/academy/index.ts')).reconcileAchievements()
    }],
  ]
  for (const [code, task] of tasks) {
    try { await task() } catch (e) { logError(code, String((e as Error)?.message ?? e)) }
  }
}
