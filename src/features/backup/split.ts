// 依實際序列化後的位元組數把資料切成數卷，每卷不超過上限；同一資料表的資料可以跨卷。
// 每一筆以緊湊 JSON 計算大小，外層與資料表名稱的固定開銷另外預留。

import { EXPORTED_TABLES, type ExportedTable } from '../../storage/index.ts'
import { BACKUP_APP, BACKUP_FORMAT, type BackupFile, type BackupScope } from './format.ts'

export const VOLUME_BYTES = 40 * 1024 * 1024

const encoder = new TextEncoder()
const bytes = (s: string) => encoder.encode(s).length

export function splitVolumes(
  data: Record<ExportedTable, unknown[]>,
  meta: { exportedAt: string; setId: string; schema: number; scope: BackupScope },
  maxBytes = VOLUME_BYTES,
): BackupFile[] {
  const envelope = (tables: Partial<Record<ExportedTable, unknown[]>>, index = 1, total = 1): BackupFile => ({
    app: BACKUP_APP, format: BACKUP_FORMAT, schema: meta.schema, scope: meta.scope, exportedAt: meta.exportedAt,
    set: { id: meta.setId, index, total }, data: tables,
  })
  // 空的外層加上全部資料表名稱的大小，卷次數字以 9999 估
  const overhead = bytes(JSON.stringify(envelope(Object.fromEntries(EXPORTED_TABLES.map(t => [t, []])), 9999, 9999)))
  const volumes: Partial<Record<ExportedTable, unknown[]>>[] = [{}]
  let used = overhead
  for (const table of EXPORTED_TABLES) {
    for (const row of data[table] ?? []) {
      const size = bytes(JSON.stringify(row)) + 1
      if (used + size > maxBytes && used > overhead) {
        volumes.push({})
        used = overhead
      }
      const current = volumes[volumes.length - 1]
      ;(current[table] ??= []).push(row)
      used += size
    }
  }
  return volumes.map((tables, i) => {
    // 每卷都列出全部資料表（沒有資料的為空陣列），匯入時不必猜缺的是哪一張
    const full = Object.fromEntries(EXPORTED_TABLES.map(t => [t, tables[t] ?? []])) as Record<ExportedTable, unknown[]>
    return envelope(full, i + 1, volumes.length)
  })
}
