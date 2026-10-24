// 頁首導覽。新頁面先以 enabled: false 上線（路徑可直接開啟，顯示「即將推出」），階段驗收通過才打開。

import type { PageId } from './routes.ts'

export interface NavItem {
  page: PageId
  to: string
  label: string
  enabled: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { page: 'hall', to: '/', label: '卦殿', enabled: true },
  { page: 'today', to: '/today', label: '今日', enabled: false },
  { page: 'divine', to: '/divine', label: '占卜', enabled: false },
  { page: 'academy', to: '/academy', label: '學堂', enabled: false },
  { page: 'me', to: '/me', label: '我的', enabled: false },
]
