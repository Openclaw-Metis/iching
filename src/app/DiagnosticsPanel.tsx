// 診斷資訊：保存模式、是否已持久保存、已用空間與配額、資料版本、各資料表筆數與最近的錯誤。
// 只在這台裝置上顯示，使用者回報問題時可以一鍵複製。

import { useEffect, useState } from 'react'
import { getStorage, maintenance, readErrors, storageStatus, type StorageStatus } from '../storage/index.ts'
import { toast } from './toast.ts'

const MODE_LABEL: Record<string, string> = {
  indexeddb: '正常保存', memory: '只在這次瀏覽（記憶體）', 'version-error': '資料版本比網站新', 'upgrade-failed': '資料更新失敗', blocked: '等待其他分頁', stale: '另一個分頁已更新',
}

const mb = (n: number | null) => (n === null ? '不明' : `${(n / 1024 / 1024).toFixed(1)} MB`)

export function DiagnosticsPanel() {
  const [status, setStatus] = useState<StorageStatus | null>(null)
  const [counts, setCounts] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    void getStorage().then(storageStatus).then(setStatus)
    void maintenance.tableCounts().then(setCounts).catch(() => setCounts(null))
  }, [])

  const report = () => JSON.stringify({ at: new Date().toISOString(), userAgent: navigator.userAgent, status, counts, errors: readErrors() }, null, 2)

  return (
    <details className="accordion diagnostics">
      <summary>診斷資訊</summary>
      {status && (
        <dl className="kv">
          <dt>保存模式</dt><dd>{MODE_LABEL[status.mode] ?? status.mode}</dd>
          <dt>持久保存</dt><dd>{status.persisted === null ? '不明' : status.persisted ? '已持久保存' : '未持久保存'}</dd>
          <dt>已用空間</dt><dd>{mb(status.usage)}／配額 {mb(status.quota)}</dd>
          <dt>資料版本</dt><dd>{status.schema ?? '不明'}</dd>
          {counts && <><dt>資料筆數</dt><dd>{Object.entries(counts).filter(([, n]) => n > 0).map(([t, n]) => `${t} ${n}`).join('、') || '沒有資料'}</dd></>}
          <dt>最近錯誤</dt><dd>{readErrors().length} 筆</dd>
        </dl>
      )}
      <button
        type="button"
        className="btn"
        onClick={() => void navigator.clipboard?.writeText(report()).then(() => toast('已複製診斷資訊'), () => toast('無法複製，請手動選取'))}
      >
        複製診斷資訊
      </button>
    </details>
  )
}
