// 匯入預覽：寫入前一定先讓使用者看到會發生什麼。檢查每個檔案的大小與格式、分卷是否齊全，
// 逐筆驗證後統計各類筆數、日期範圍、與現有資料重複的筆數、已修正與無效的筆數。

import { AppError } from '../../lib/errors.ts'
import { EXPORTED_TABLES, requireDb, type ExportedTable } from '../../storage/index.ts'
import type { BackupScope, BackupSet } from './format.ts'
import { keyOf } from './merge.ts'
import { MAX_FILE_BYTES, parseBackupText, validateEnvelope, validateTables, type BackupEnvelope } from './validate.ts'

/** File 符合這個介面；測試可以傳入假的來源 */
export interface ImportSource {
  name: string
  size: number
  text(): Promise<string>
}

export interface ImportPreview {
  scope: BackupScope
  format: number
  schema: number
  set: BackupSet
  exportedAt: string
  files: number
  counts: Record<ExportedTable, number>
  total: number
  duplicates: number
  corrected: number
  invalid: number
  dateRange: { from: string; to: string } | null
  rows: Record<ExportedTable, unknown[]>
}

function checkSet(envelopes: BackupEnvelope[]) {
  const first = envelopes[0]
  const sameSet = envelopes.every(e => e.set.id === first.set.id && e.set.total === first.set.total
    && e.format === first.format && e.schema === first.schema && e.scope === first.scope)
  if (!sameSet) throw new AppError('IMPORT_INCOMPLETE_SET', '選取的檔案來自不同次的匯出，請只選同一次匯出的所有檔案。')
  const indexes = new Set(envelopes.map(e => e.set.index))
  if (indexes.size !== envelopes.length) throw new AppError('IMPORT_INCOMPLETE_SET', '同一份檔案選了兩次，請把同一次匯出的所有檔案各選一次。')
  const missing = Array.from({ length: first.set.total }, (_, i) => i + 1).filter(i => !indexes.has(i))
  if (missing.length) throw new AppError('IMPORT_INCOMPLETE_SET', `還缺第 ${missing.join('、')} 份檔案，請把同一次匯出的所有檔案一起選取。`)
}

// 預覽的日期範圍：各類資料的發生時間
const TIME_FIELDS: Partial<Record<ExportedTable, string>> = {
  readings: 'createdAt', dailyDraws: 'drawnAt', xpEvents: 'at', examResults: 'at', reviewLogs: 'reviewedAt', checkIns: 'reachedAt',
}

export async function previewImport(sources: ImportSource[]): Promise<ImportPreview> {
  if (!sources.length) throw new AppError('IMPORT_INVALID_FILE')
  // 先看大小再讀內容，太大的檔案不讀
  if (sources.some(s => s.size > MAX_FILE_BYTES)) throw new AppError('IMPORT_TOO_LARGE')
  const envelopes: BackupEnvelope[] = []
  for (const source of sources) envelopes.push(validateEnvelope(parseBackupText(await source.text())))
  checkSet(envelopes)
  envelopes.sort((a, b) => a.set.index - b.set.index)

  const data: BackupEnvelope['data'] = {}
  for (const table of EXPORTED_TABLES) {
    const parts = envelopes.map(e => e.data[table]).filter(v => v !== undefined)
    data[table] = parts.every(Array.isArray) ? parts.flat() : parts.find(v => !Array.isArray(v)) ?? []
  }
  const checked = validateTables(data)

  const db = await requireDb()
  let duplicates = 0, corrected = 0, invalid = 0, total = 0
  let from: string | null = null, to: string | null = null
  const rows = {} as Record<ExportedTable, unknown[]>
  const counts = {} as Record<ExportedTable, number>
  for (const table of EXPORTED_TABLES) {
    const { valid, corrected: c, invalid: i } = checked[table]
    rows[table] = valid
    counts[table] = valid.length
    total += valid.length
    corrected += c
    invalid += i
    if (!valid.length) continue
    const keys = valid.map(r => keyOf(table, r))
    duplicates += table === 'xpEvents'
      ? await db.xpEvents.where('key').anyOf(keys as string[]).count()
      : (await db.table(table).bulkGet(keys)).filter(Boolean).length
    const field = TIME_FIELDS[table]
    if (field) {
      for (const r of valid) {
        const t = (r as Record<string, string>)[field]
        if (!from || t < from) from = t
        if (!to || t > to) to = t
      }
    }
  }

  const first = envelopes[0]
  return {
    scope: first.scope, format: first.format, schema: first.schema, set: first.set, exportedAt: first.exportedAt, files: envelopes.length,
    counts, total, duplicates, corrected, invalid, dateRange: from && to ? { from, to } : null, rows,
  }
}
