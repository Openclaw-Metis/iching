// 短暫回饋（已保存、已刪除附復原、有新版本）。任何模組都能呼叫 toast()，由 Layout 裡的 <Toaster> 顯示。

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastItem {
  id: number
  message: string
  action?: ToastAction
}

const DEFAULT_MS = 4000
let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => { for (const l of listeners) l() }

export function toast(message: string, options: { action?: ToastAction; durationMs?: number } = {}) {
  const item: ToastItem = { id: nextId++, message, action: options.action }
  items = [...items, item]
  emit()
  setTimeout(() => dismissToast(item.id), options.durationMs ?? DEFAULT_MS)
  return item.id
}

export function dismissToast(id: number) {
  if (!items.some(t => t.id === id)) return
  items = items.filter(t => t.id !== id)
  emit()
}

export const toastSnapshot = () => items

export function subscribeToasts(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
