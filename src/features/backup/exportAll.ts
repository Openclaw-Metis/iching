// 匯出全部資料：以資料表清單迭代所有會匯出的表（之後新增的表自動納入），
// 不含起卦草稿、作答進度、中繼資料與只屬於這台裝置的設定鍵。

import { EXPORTED_SETTING_KEYS, EXPORTED_TABLES, requireDb, SCHEMA_VERSION, type ExportedTable, type Setting } from '../../storage/index.ts'
import { backupFileName } from './format.ts'
import { splitVolumes, VOLUME_BYTES } from './split.ts'

export interface ExportFile {
  name: string
  text: string
}

export interface ExportResult {
  files: ExportFile[]
  counts: Record<ExportedTable, number>
}

export async function exportAll(options: { now?: Date; maxBytes?: number } = {}): Promise<ExportResult> {
  const now = options.now ?? new Date()
  const db = await requireDb()
  const tables = EXPORTED_TABLES.map(t => db.table(t))
  // 同一個讀取交易，各表的資料彼此一致
  const data = await db.transaction('r', tables, async () => {
    const out = {} as Record<ExportedTable, unknown[]>
    for (const t of EXPORTED_TABLES) out[t] = await db.table(t).toArray()
    return out
  })
  data.settings = (data.settings as Setting[]).filter(s => (EXPORTED_SETTING_KEYS as readonly string[]).includes(s.key))
  const volumes = splitVolumes(data, { exportedAt: now.toISOString(), setId: crypto.randomUUID(), schema: SCHEMA_VERSION, scope: 'full' }, options.maxBytes ?? VOLUME_BYTES)
  return {
    files: volumes.map(v => ({ name: backupFileName(now, v.set.index, v.set.total), text: JSON.stringify(v) })),
    counts: Object.fromEntries(EXPORTED_TABLES.map(t => [t, data[t].length])) as Record<ExportedTable, number>,
  }
}
