// 設定：單值覆寫並帶 updatedAt，合併備份時才知道哪一邊較新。
// 只有 dailyGoal、reminderTime 會匯出；其餘鍵只屬於這台裝置。

import { requireDb } from '../connection.ts'

export interface SettingValues {
  dailyGoal: 20 | 30 | 50
  reminderTime: string
  lastBackupAt: string
  lastCleanup: string
  persistAsked: boolean
  backupSnoozeUntil: string
  onboardingSeen: boolean
}

export type SettingKey = keyof SettingValues

export const SETTING_DEFAULTS: Pick<SettingValues, 'dailyGoal' | 'reminderTime'> = {
  dailyGoal: 30,
  reminderTime: '07:30',
}

export async function get<K extends SettingKey>(key: K): Promise<SettingValues[K] | undefined> {
  const db = await requireDb()
  const row = await db.settings.get(key)
  if (row) return row.value as SettingValues[K]
  return (SETTING_DEFAULTS as Partial<SettingValues>)[key]
}

export async function set<K extends SettingKey>(key: K, value: SettingValues[K], now = new Date()) {
  const db = await requireDb()
  await db.settings.put({ key, value, updatedAt: now.toISOString() })
}

/** 首次使用時寫入預設值；已存在的鍵不動 */
export async function ensureDefaults(now = new Date()) {
  const db = await requireDb()
  await db.transaction('rw', db.settings, async () => {
    for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
      if (!(await db.settings.get(key))) await db.settings.add({ key, value, updatedAt: now.toISOString() })
    }
  })
}
