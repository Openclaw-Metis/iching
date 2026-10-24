// App 啟動時、首屏顯示後才執行的背景工作（規格「通知與背景執行」）。這個模組以 import() 載入，
// 它靜態匯入的保存層因此不會進卦殿首屏。

import { logError, readings, settings } from '../storage/index.ts'

export async function runStartupTasks() {
  const tasks: [string, () => Promise<unknown>][] = [
    ['STARTUP_DEFAULTS', () => settings.ensureDefaults()],
    // 軟刪除超過 10 秒的紀錄（關閉頁面前來不及清掉的）
    ['STARTUP_PURGE', () => readings.purgeDeleted()],
  ]
  for (const [code, task] of tasks) {
    try { await task() } catch (e) { logError(code, String((e as Error)?.message ?? e)) }
  }
}
