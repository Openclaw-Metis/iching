// 套用匯入：合併或取代都在單一交易中完成，失敗時整批回滾，不留下半套資料。
// 取代只限完整且分卷齊全的備份：清空會匯出的資料表與作答進度，保留起卦草稿、中繼資料與只屬於這台裝置的設定。

import { AppError } from '../../lib/errors.ts'
import { EXPORTED_SETTING_KEYS, EXPORTED_TABLES, logError, requireDb, type ExportedTable, type XpEvent } from '../../storage/index.ts'
import { keyOf, mergeRow } from './merge.ts'
import type { ImportPreview } from './preview.ts'

export type ImportMode = 'merge' | 'replace'

export interface ImportResult {
  written: number
  skipped: number
}

export async function applyImport(preview: ImportPreview, mode: ImportMode): Promise<ImportResult> {
  if (mode === 'replace' && preview.scope !== 'full') throw new AppError('IMPORT_INVALID_FILE', '這個檔案只含一筆結果，只能合併。')
  const db = await requireDb()
  const tables = [...EXPORTED_TABLES.map(t => db.table(t)), db.attempts]
  let written = 0

  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      // 取代後的 rev 必須使其他分頁尚未保存的編輯失效，也不能倒退到舊備份的版本。
      const readingRevs = new Map((await db.readings.toArray()).map(r => [r.id, r.rev]))
      const dailyRevs = new Map((await db.dailyDraws.toArray()).map(r => [r.date, r.rev]))
      for (const table of EXPORTED_TABLES) {
        if (table === 'settings') await db.settings.bulkDelete([...EXPORTED_SETTING_KEYS])
        else await db.table(table).clear()
      }
      await db.attempts.clear()
      for (const table of EXPORTED_TABLES) {
        const rows = preview.rows[table].map(row => {
          if (table !== 'readings' && table !== 'dailyDraws') return row
          const r = row as { id?: string; date?: string; rev: number }
          const localRev = table === 'readings' ? readingRevs.get(r.id!) : dailyRevs.get(r.date!)
          return { ...r, rev: Math.max(localRev ?? 0, r.rev) + 1 }
        })
        if (rows.length) await db.table(table).bulkAdd(rows)
        written += rows.length
      }
      return
    }

    for (const table of EXPORTED_TABLES) {
      const rows = preview.rows[table]
      if (!rows.length) continue
      const keys = rows.map(r => keyOf(table, r))
      const locals: (unknown | undefined)[] = table === 'xpEvents'
        ? await (async () => {
          const found = new Map((await db.xpEvents.where('key').anyOf(keys as string[]).toArray()).map(e => [e.key, e]))
          return keys.map(k => found.get(k as string))
        })()
        : await db.table(table).bulkGet(keys)
      const toWrite: unknown[] = []
      const replacedXp: string[] = []
      rows.forEach((row, i) => {
        const merged = mergeRow(table as ExportedTable, row, locals[i])
        if (merged === null) return
        toWrite.push(merged)
        // XP 事件以業務鍵去重：檔案裡那筆較早時，換掉本機那筆（主鍵不同）
        if (table === 'xpEvents' && locals[i]) replacedXp.push((locals[i] as XpEvent).id)
      })
      if (replacedXp.length) await db.xpEvents.bulkDelete(replacedXp)
      if (toWrite.length) await db.table(table).bulkPut(toWrite)
      written += toWrite.length
    }
  })

  // 匯入的課程、考核、打卡與掌握紀錄可能帶來新的印章與溫故卡；補發失敗不影響已完成的匯入
  try {
    await (await import('../academy/index.ts')).reconcileAchievements()
  } catch (e) {
    logError('IMPORT_RECONCILE_FAILED', String((e as Error)?.message ?? e))
  }
  return { written, skipped: preview.total - written + preview.invalid }
}
