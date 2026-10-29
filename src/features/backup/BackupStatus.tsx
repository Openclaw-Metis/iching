// 書卜頁首的狀態列（規格「2026-10-29 介面檢視後修訂」）：紀錄只存在這個瀏覽器，所以把筆數、最近一次與
// 上次備份放在一眼看得到的地方，旁邊就能匯出。原本獨立的 30 天備份提醒也併在這一列：上次匯出超過 30 天
// （從沒匯出過時，從第一筆紀錄算起）就提示，按「稍後」7 天內不再提醒。

import { useState } from 'react'
import { formatDateTime } from '../../lib/dates.ts'
import { logError, settings, useDb, useLiveQuery, type IchingDB } from '../../storage/index.ts'
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

export interface BackupStatusInfo {
  readings: number
  daily: number
  /** 最近一次占卜或翻開今日卦的時間 */
  latest: string | null
  lastBackup: string | null
  remind: boolean
}

// 占卜與今日卦有變動、匯出之後都會重算
export async function backupStatusOf(db: IchingDB, now = new Date()): Promise<BackupStatusInfo> {
  const live = db.readings.filter(r => !r.deletedAt)
  const [readings, daily, lastReading, lastDaily, lastBackup, remind] = await Promise.all([
    live.count(),
    db.dailyDraws.count(),
    db.readings.orderBy('[createdAt+id]').reverse().filter(r => !r.deletedAt).first(),
    db.dailyDraws.toCollection().last(),
    db.settings.get('lastBackupAt'),
    needsBackupReminder(db, now),
  ])
  const times = [lastReading?.createdAt, lastDaily?.drawnAt].filter((t): t is string => Boolean(t)).sort()
  return { readings, daily, latest: times.at(-1) ?? null, lastBackup: (lastBackup?.value as string | undefined) ?? null, remind }
}

export function BackupStatus() {
  const db = useDb()
  const info = useLiveQuery(() => (db ? backupStatusOf(db) : undefined), [db])
  const [snoozed, setSnoozed] = useState(false)
  const [failed, setFailed] = useState(false)
  if (!info || (info.readings === 0 && info.daily === 0)) return null
  const remind = info.remind && !snoozed

  const runExport = () => {
    setFailed(false)
    exportAndDownload().catch(e => {
      logError('EXPORT_FAILED', String((e as Error).message))
      setFailed(true)
    })
  }

  return (
    <section className="backup-status" aria-label="紀錄與備份狀態" data-remind={remind || undefined}>
      <span>{info.readings} 則占卜</span>
      <span>{info.daily} 則今日卦</span>
      {info.latest && <span>最近一次 {formatDateTime(info.latest)}</span>}
      {info.lastBackup ? <span>上次備份 {formatDateTime(info.lastBackup)}</span> : <span className="warn">尚未備份</span>}
      {failed && <span className="warn" role="alert">匯出沒有成功，請再試一次。</span>}
      {remind && <p className="backup-status-remind" role="status">已經 30 天沒有備份了，建議匯出一次，換裝置或清除瀏覽器時才不會遺失。</p>}
      <span className="backup-status-actions">
        {remind && (
          <button type="button" className="btn" onClick={() => {
            setSnoozed(true)
            void settings.set('backupSnoozeUntil', new Date(Date.now() + SNOOZE_MS).toISOString())
          }}>稍後</button>
        )}
        <button type="button" className="btn btn-primary" onClick={runExport}>匯出備份</button>
      </span>
    </section>
  )
}
