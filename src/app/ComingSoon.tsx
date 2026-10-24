// 尚未完成的頁面先以占位頁上線：路徑可直接開啟、標題正確，導覽旗標打開前不會出現在頁首。

import { Link, useLocation } from 'react-router'
import { routeFor, SITE_NAME } from './routes.ts'

export function ComingSoon() {
  const { pathname } = useLocation()
  const heading = routeFor(pathname)?.title.split('｜')[0] ?? SITE_NAME
  return (
    <section className="placeholder">
      <h1>{heading}</h1>
      <p>這個功能即將推出。</p>
      <Link className="btn" to="/">回到卦殿</Link>
    </section>
  )
}

export function NotFound() {
  return (
    <section className="placeholder">
      <h1>找不到這一頁</h1>
      <p>網址可能打錯了，或這一頁已經搬走。</p>
      <Link className="btn" to="/">回到卦殿</Link>
    </section>
  )
}
