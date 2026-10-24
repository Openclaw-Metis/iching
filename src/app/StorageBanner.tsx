// 保存相關的警示列。保存層在首屏顯示後才以 import() 載入，卦殿首屏不因 Dexie 變重。
// 改用記憶體時可以關閉（當次不再出現）；版本錯誤、升級失敗、等待其他分頁、分頁過期都不能關閉。

import { useEffect, useState } from 'react'
import { ERROR_MESSAGES } from '../lib/errors.ts'
import type { StorageMode } from '../storage/open.ts'
import { afterFirstPaint } from './idle.ts'

type Mode = StorageMode | 'opening'

const MESSAGES: Partial<Record<Mode, string>> = {
  memory: ERROR_MESSAGES.STORAGE_UNAVAILABLE,
  'version-error': ERROR_MESSAGES.STORAGE_VERSION,
  'upgrade-failed': ERROR_MESSAGES.STORAGE_UPGRADE_FAILED,
  blocked: ERROR_MESSAGES.STORAGE_BLOCKED,
  stale: ERROR_MESSAGES.STORAGE_STALE_TAB,
}

export function StorageBanner() {
  const [mode, setMode] = useState<Mode>('opening')
  const [dismissed, setDismissed] = useState(false)
  const [details, setDetails] = useState('')

  useEffect(() => {
    let unsubscribe = () => {}
    let cancelled = false
    const cancel = afterFirstPaint(() => {
      import('../storage/index.ts').then(storage => {
        if (cancelled) return
        const update = () => {
          const m = storage.currentStorageMode()
          setMode(m)
          if (m === 'upgrade-failed') setDetails(JSON.stringify(storage.readErrors().slice(-5), null, 2))
        }
        unsubscribe = storage.subscribeStorageMode(update)
        update()
        void storage.getStorage()
      })
    })
    return () => { cancelled = true; cancel(); unsubscribe() }
  }, [])

  const message = MESSAGES[mode]
  if (!message || (mode === 'memory' && dismissed)) return null

  return (
    <div className="storage-banner" role="alert" data-mode={mode}>
      <p>{message}</p>
      <div className="storage-banner-actions">
        {mode === 'memory' && <button type="button" className="btn" onClick={() => setDismissed(true)}>知道了</button>}
        {(mode === 'version-error' || mode === 'stale' || mode === 'upgrade-failed') && (
          <button type="button" className="btn" onClick={() => location.reload()}>{mode === 'upgrade-failed' ? '重試' : '重新整理'}</button>
        )}
        {mode === 'upgrade-failed' && details && (
          <button type="button" className="btn" onClick={() => void navigator.clipboard?.writeText(details)}>複製診斷資訊</button>
        )}
      </div>
    </div>
  )
}
