// 備份檔格式（規格「核心資料模型：備份檔格式」）。完整備份由「匯出全部資料」產生，必要時分卷；
// 保存失敗時下載的單筆結果是部分備份（scope: 'partial'，只有 readings 一筆），只能合併、不能取代。

import { SCHEMA_VERSION, type ExportedTable, type Reading } from '../../storage/index.ts'

export const BACKUP_APP = 'iching'
export const BACKUP_FORMAT = 1

export type BackupScope = 'full' | 'partial'

export interface BackupSet {
  /** 同一次匯出的所有分卷共用 */
  id: string
  index: number
  total: number
}

export interface BackupFile {
  app: typeof BACKUP_APP
  format: number
  schema: number
  scope: BackupScope
  exportedAt: string
  set: BackupSet
  data: Partial<Record<ExportedTable, unknown[]>>
}

const pad = (n: number) => String(n).padStart(2, '0')
const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`

/** iching-backup-YYYYMMDD.json；多卷時加上 -<index>of<total> */
export const backupFileName = (date: Date, index = 1, total = 1) =>
  total > 1 ? `iching-backup-${stamp(date)}-${index}of${total}.json` : `iching-backup-${stamp(date)}.json`

/** 保存失敗時下載的單筆結果：iching-reading-YYYYMMDD-HHmm.json */
export const readingFileName = (date: Date) => `iching-reading-${stamp(date)}-${pad(date.getHours())}${pad(date.getMinutes())}.json`

export function partialBackup(reading: Reading, now = new Date()): BackupFile {
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    schema: SCHEMA_VERSION,
    scope: 'partial',
    exportedAt: now.toISOString(),
    set: { id: crypto.randomUUID(), index: 1, total: 1 },
    data: { readings: [reading] },
  }
}

/** 讓瀏覽器下載檔案 */
export function downloadFile(content: BlobPart, fileName: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
