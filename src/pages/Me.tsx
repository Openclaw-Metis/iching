import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { DiagnosticsPanel } from '../app/DiagnosticsPanel.tsx'
import { BackupPanel, BackupReminder, ClearDataButton } from '../features/backup/index.ts'
import { RecordDetail, RecordList } from '../features/records/index.ts'

// 收藏與印譜分頁在之後的階段打開
type Tab = 'records' | 'settings'
const TABS: { id: Tab; label: string }[] = [
  { id: 'records', label: '紀錄' },
  { id: 'settings', label: '設定與備份' },
]
const TAB_KEY = 'iching:me-tab'

function loadTab(): Tab {
  try {
    const saved = localStorage.getItem(TAB_KEY)
    return TABS.some(t => t.id === saved) ? (saved as Tab) : 'records'
  } catch {
    return 'records'
  }
}

export function Me() {
  const [params] = useSearchParams()
  const record = params.get('record')
  const [tab, setTabState] = useState<Tab>(loadTab)
  const setTab = (t: Tab) => {
    setTabState(t)
    try { localStorage.setItem(TAB_KEY, t) } catch { /* 偏好記不住而已 */ }
  }

  if (record) {
    return (
      <div className="me">
        <header className="page-head"><h1>我的</h1></header>
        <RecordDetail id={record} />
      </div>
    )
  }

  return (
    <div className="me">
      <header className="page-head"><h1>我的</h1></header>
      <BackupReminder />
      <div className="tabs me-tabs" role="tablist">
        {TABS.map(t => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      <div className="panel" role="tabpanel">
        {tab === 'records' && <RecordList onRestoreBackup={() => setTab('settings')} />}
        {tab === 'settings' && (
          <>
            <BackupPanel />
            <ClearDataButton />
            <section className="settings-section">
              <DiagnosticsPanel />
            </section>
          </>
        )}
      </div>
    </div>
  )
}
