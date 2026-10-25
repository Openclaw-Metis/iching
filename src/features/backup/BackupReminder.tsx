// 備份提醒：上次匯出超過 30 天（從沒匯出過時，從第一筆紀錄算起）且有紀錄時，在「書卜」頁上方提示一次；
// 按「稍後」7 天內不再出現。

import { useState } from 'react'
import { settings, useDb, useLiveQuery, type IchingDB } from '../../storage/index.ts'
import { exportAndDownload } from './BackupPanel.tsx'

const DAY_MS = 86_400_000
const REMIND_AFTER_MS = 30 * DAY_MS
const SNOOZE_MS = 7 * DAY_MS

// 直接用資料庫查詢（不經過其他非同步步驟），liveQuery 才追蹤得到讀取的資料表
export async function needsBackupReminder(db: IchingDB, now = new Date()): Promise<boolean> {
  const snooze = (await db.settings.get('backupSnoozeUntil'))?.value as string | undefined
  if (snooze && Date.parse(snooze) > now.getTime()) return false
  const first = await db.readings.orderBy('[createdAt+id]').filter(r => !r.deletedAt).first()
  if (!first) return false
  const last = (await db.settings.get('lastBackupAt'))?.value as string | undefined
  const since = last ?? first.createdAt
  return now.getTime() - Date.parse(since) >= REMIND_AFTER_MS
}

export function BackupReminder() {
  const db = useDb()
  const [dismissed, setDismissed] = useState(false)
  // 訂閱設定與紀錄：匯出或按「稍後」之後提示自動消失
  const show = useLiveQuery(() => (db ? needsBackupReminder(db) : false), [db], false)
  if (!show || dismissed) return null
  return (
    <div className="reminder-bar" role="status">
      <p>已經 30 天沒有備份了，建議匯出一次，換裝置或清除瀏覽器時才不會遺失。</p>
      <div className="storage-banner-actions">
        <button type="button" className="btn btn-strong" onClick={() => void exportAndDownload().catch(() => {})}>匯出</button>
        <button type="button" className="btn" onClick={() => {
          setDismissed(true)
          void settings.set('backupSnoozeUntil', new Date(Date.now() + SNOOZE_MS).toISOString())
        }}>稍後</button>
      </div>
    </div>
  )
}
