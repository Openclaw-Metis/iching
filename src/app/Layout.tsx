import { Suspense, useEffect } from 'react'
import { NavLink, Outlet, ScrollRestoration, useLocation, useRouteError } from 'react-router'
import { afterFirstPaint } from './idle.ts'
import { NAV_ITEMS } from './nav.ts'
import { titleFor } from './routes.ts'
import { StorageBanner } from './StorageBanner.tsx'
import { Toaster } from './Toaster.tsx'

function Header() {
  return (
    <header className="site-header">
      <NavLink to="/" className="brand" aria-label="易經卦殿首頁">
        <svg viewBox="0 0 60 60" aria-hidden="true">
          <g fill="var(--gold)">
            <rect x="6" y="8" width="48" height="6" rx="1" />
            <rect x="6" y="20" width="21" height="6" rx="1" /><rect x="33" y="20" width="21" height="6" rx="1" />
            <rect x="6" y="32" width="48" height="6" rx="1" />
            <rect x="6" y="44" width="21" height="6" rx="1" /><rect x="33" y="44" width="21" height="6" rx="1" />
          </g>
        </svg>
        <strong>易經卦殿</strong>
        <small>六十四卦卦牌</small>
      </NavLink>
      <nav className="site-nav" aria-label="主選單">
        {NAV_ITEMS.filter(item => item.enabled).map(item => (
          <NavLink key={item.page} to={item.to} end={item.to === '/'}>{item.label}</NavLink>
        ))}
      </nav>
    </header>
  )
}

// 標題只依 routes.ts，各頁不自己設定，靜態 index.html 與前端切換頁面時才會一致
function useDocumentTitle() {
  const { pathname } = useLocation()
  useEffect(() => { document.title = titleFor(pathname) }, [pathname])
}

// 啟動時的背景工作在首屏顯示後才載入，保存層不進卦殿首屏
function useStartupTasks() {
  useEffect(() => afterFirstPaint(() => { void import('./startup.ts').then(m => m.runStartupTasks()) }), [])
}

export function Layout() {
  useDocumentTitle()
  useStartupTasks()
  return (
    <>
      <Header />
      <StorageBanner />
      <main>
        <Suspense fallback={<p className="note" style={{ textAlign: 'center', marginTop: 48 }}>載入中…</p>}>
          <Outlet />
        </Suspense>
      </main>
      <Toaster />
      <ScrollRestoration />
    </>
  )
}

// 延遲載入的頁面抓不到（多半是離線，或網站更新後舊檔已被移除）時的畫面
export function RouteError() {
  const error = useRouteError() as Error | undefined
  return (
    <>
      <Header />
      <main>
        <section className="placeholder" role="alert">
          <h1>頁面載入失敗</h1>
          <p>請確認網路後重新整理。{error?.message ? <small className="note">（{error.message}）</small> : null}</p>
          <button type="button" className="btn" onClick={() => location.reload()}>重新整理</button>
        </section>
      </main>
    </>
  )
}
