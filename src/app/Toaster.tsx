import { useSyncExternalStore } from 'react'
import { dismissToast, subscribeToasts, toastSnapshot } from './toast.ts'

export function Toaster() {
  const items = useSyncExternalStore(subscribeToasts, toastSnapshot, toastSnapshot)
  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map(t => (
        <div key={t.id} className="toast">
          <span>{t.message}</span>
          {t.action && (
            <button type="button" className="toast-action" onClick={() => { t.action!.onClick(); dismissToast(t.id) }}>
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
