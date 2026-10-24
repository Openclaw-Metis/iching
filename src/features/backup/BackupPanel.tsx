// 設定與備份：匯出全部資料（必要時分成數個檔案）、選檔匯入（分卷時一次選取全部）並先預覽。

import { useRef, useState } from 'react'
import { toast } from '../../app/toast.ts'
import { formatDateTime } from '../../lib/dates.ts'
import { ERROR_MESSAGES, isAppError } from '../../lib/errors.ts'
import { track } from '../../lib/events.ts'
import { logError, settings, useDb, useLiveQuery } from '../../storage/index.ts'
import { applyImport, type ImportMode } from './apply.ts'
import { exportAll } from './exportAll.ts'
import { downloadFile } from './format.ts'
import { ImportPreviewDialog } from './ImportPreviewDialog.tsx'
import { previewImport, type ImportPreview } from './preview.ts'

/** 匯出並下載，記下最後備份時間；「我的」頁的備份提醒也用這個 */
export async function exportAndDownload() {
  const { files, counts } = await exportAll()
  for (const [i, f] of files.entries()) {
    // 連續觸發多個下載時，部分瀏覽器會擋掉後面的，稍微錯開
    if (i > 0) await new Promise(r => setTimeout(r, 400))
    downloadFile(f.text, f.name)
  }
  await settings.set('lastBackupAt', new Date().toISOString())
  track('backup_exported', { counts })
  toast(files.length > 1 ? `已匯出 ${files.length} 個檔案，匯入時請一起選取。` : '已匯出備份檔。')
}

export function BackupPanel() {
  const db = useDb()
  const lastBackup = useLiveQuery(() => db?.settings.get('lastBackupAt'), [db])
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const runExport = async () => {
    setMessage('')
    try {
      await exportAndDownload()
    } catch (e) {
      logError('EXPORT_FAILED', String((e as Error).message))
      setMessage('匯出沒有成功，請再試一次。')
    }
  }

  const pick = async (files: FileList | null) => {
    if (!files?.length) return
    setMessage('正在讀取備份檔……')
    try {
      const p = await previewImport([...files])
      track('import_previewed', { counts: p.counts })
      setMessage('')
      setPreview(p)
    } catch (e) {
      track('import_failed', { errorCode: isAppError(e) ? e.code : 'unknown' })
      setMessage(isAppError(e) ? e.message : ERROR_MESSAGES.IMPORT_INVALID_FILE)
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  const confirm = async (mode: ImportMode) => {
    if (!preview) return
    setBusy(true)
    try {
      const result = await applyImport(preview, mode)
      track('import_applied', { counts: preview.counts, mode })
      setPreview(null)
      toast(`已匯入 ${result.written} 筆`)
    } catch (e) {
      track('import_failed', { mode, errorCode: isAppError(e) ? e.code : 'unknown' })
      logError(isAppError(e) ? e.code : 'IMPORT_FAILED', String((e as Error).message))
      setPreview(null)
      setMessage(isAppError(e) ? e.message : '匯入失敗，資料沒有變動。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="settings-section" aria-labelledby="backup-title">
      <h3 id="backup-title">備份</h3>
      <p className="note">
        紀錄與學習進度只存在這台裝置的這個瀏覽器。換裝置或清除瀏覽器前，先匯出一個備份檔。
        {lastBackup?.value ? ` 上次匯出：${formatDateTime(lastBackup.value as string)}。` : ' 還沒有匯出過。'}
      </p>
      <div className="step-actions start">
        <button type="button" className="btn btn-strong" onClick={() => void runExport()}>匯出全部資料</button>
        <button type="button" className="btn" onClick={() => input.current?.click()}>匯入</button>
        <input ref={input} type="file" accept=".json,application/json" multiple hidden onChange={e => void pick(e.target.files)} />
      </div>
      {message && <p className="note" role="status">{message}</p>}
      <ImportPreviewDialog preview={preview} busy={busy} onConfirm={mode => void confirm(mode)} onCancel={() => setPreview(null)} />
    </section>
  )
}
