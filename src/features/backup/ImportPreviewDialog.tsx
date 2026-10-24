// 匯入預覽：各類資料筆數、日期範圍、重複筆數、自動修正與略過的筆數、檔案版本。
// 使用者選「合併」或「取代」並確認後才寫入；部分備份（單筆結果）停用取代。

import { useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { formatDate } from '../../lib/dates.ts'
import { EXPORTED_TABLES, type ExportedTable } from '../../storage/index.ts'
import type { ImportMode } from './apply.ts'
import type { ImportPreview } from './preview.ts'

export const TABLE_LABELS: Record<ExportedTable, string> = {
  readings: '占卜紀錄', dailyDraws: '今日卦', favorites: '收藏卦牌', quotes: '金句', lessonProgress: '課程進度', examResults: '考核結果',
  reviewCards: '溫故卡', reviewLogs: '溫故紀錄', mastery: '掌握紀錄', xpEvents: 'XP 事件', checkIns: '打卡', seals: '印章', settings: '設定',
}

interface Props {
  preview: ImportPreview | null
  busy: boolean
  onConfirm: (mode: ImportMode) => void
  onCancel: () => void
}

export function ImportPreviewDialog({ preview, busy, onConfirm, onCancel }: Props) {
  const [mode, setMode] = useState<ImportMode>('merge')
  const partial = preview?.scope === 'partial'
  const chosen: ImportMode = partial ? 'merge' : mode

  return (
    <ConfirmDialog
      open={preview !== null}
      title="匯入前先看一下"
      confirmLabel={busy ? '匯入中…' : chosen === 'replace' ? '取代並匯入' : '合併並匯入'}
      danger={chosen === 'replace'}
      onConfirm={() => { if (!busy) onConfirm(chosen) }}
      onCancel={onCancel}
    >
      {preview && (
        <div className="import-preview">
          <p className="note">
            {preview.scope === 'full' ? '完整備份' : '單筆結果（部分備份）'}・{preview.files} 個檔案・匯出於 {formatDate(preview.exportedAt)}・格式第 {preview.format} 版
            {preview.dateRange && <>・資料期間 {formatDate(preview.dateRange.from)} 到 {formatDate(preview.dateRange.to)}</>}
          </p>
          <table className="preview-table">
            <tbody>
              {EXPORTED_TABLES.filter(t => preview.counts[t] > 0).map(t => (
                <tr key={t}><th scope="row">{TABLE_LABELS[t]}</th><td>{preview.counts[t]} 筆</td></tr>
              ))}
            </tbody>
          </table>
          <p>
            共 {preview.total} 筆，其中 {preview.duplicates} 筆和這台裝置現有的資料重複。
            {preview.corrected > 0 && ` ${preview.corrected} 筆已自動修正。`}
            {preview.invalid > 0 && ` 有 ${preview.invalid} 筆格式不正確，將會略過。`}
          </p>
          <fieldset className="choice-group">
            <legend>匯入方式</legend>
            <div className="segmented-radio">
              <label>
                <input type="radio" name="import-mode" checked={chosen === 'merge'} onChange={() => setMode('merge')} />
                <span>合併（保留兩邊）</span>
              </label>
              <label>
                <input type="radio" name="import-mode" checked={chosen === 'replace'} disabled={partial} onChange={() => setMode('replace')} />
                <span>取代（只留檔案裡的）</span>
              </label>
            </div>
            {partial && <p className="note">這個檔案只含一筆結果，只能合併。</p>}
            {chosen === 'replace' && <p className="note">取代會先清掉這台裝置的紀錄與學習進度，再寫入檔案內容。</p>}
          </fieldset>
        </div>
      )}
    </ConfirmDialog>
  )
}
