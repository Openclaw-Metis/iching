// UI 事件回報（規格「UI 事件回報」）：只在瀏覽器內使用，不傳到任何伺服器。
// 開發模式輸出到主控台；最近 100 筆留在記憶體，自動化測試可從 window.__ichingEvents 斷言流程有走到。

export interface UiEvent {
  name: string
  data: Record<string, unknown>
  at: string
}

const MAX = 100
const events: UiEvent[] = []

export function track(name: string, data: Record<string, unknown> = {}) {
  const event = { name, data, at: new Date().toISOString() }
  events.push(event)
  if (events.length > MAX) events.shift()
  if (import.meta.env?.DEV) console.info(`[event] ${name}`, data)
}

export const recentEvents = () => [...events]

if (typeof window !== 'undefined') (window as unknown as { __ichingEvents: () => UiEvent[] }).__ichingEvents = recentEvents
