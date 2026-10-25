import { lazy, Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, ScrollRestoration, useLocation, useRouteError } from 'react-router'
import { afterFirstPaint } from './idle.ts'
import { NAV_ITEMS } from './nav.ts'
import { titleFor } from './routes.ts'
import { StorageBanner } from './StorageBanner.tsx'
import { Toaster } from './Toaster.tsx'
import { Drawer } from '../components/Drawer.tsx'

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <>
      <a className="skip-link" href="#main-content">跳至主要內容</a>
      <header className="site-header">
        <div className="header-inner">
          <NavLink to="/" className="brand" aria-label="易經卦殿首頁">
            <img className="brand-mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={36} height={36} />
            <strong>易經卦殿</strong>
          </NavLink>
          <nav className="site-nav desktop-nav" aria-label="主選單">
            {NAV_ITEMS.filter(item => item.enabled).map(item => (
              <NavLink key={item.page} to={item.to} end={item.to === '/'}>{item.label}</NavLink>
            ))}
          </nav>
          <button type="button" className="menu-toggle" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>選單</button>
        </div>
      </header>
      <Drawer open={menuOpen} title="易經卦殿" onClose={() => setMenuOpen(false)}>
        <nav className="mobile-nav" aria-label="手機主選單">
          {NAV_ITEMS.filter(item => item.enabled).map(item => (
            <NavLink key={item.page} to={item.to} end={item.to === '/'} onClick={() => setMenuOpen(false)}>{item.label}</NavLink>
          ))}
        </nav>
      </Drawer>
    </>
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

// 離線版的註冊與新版本提示：只在正式建置，首屏顯示後才載入
const UpdateToast = lazy(() => import('./UpdateToast.tsx'))

function useAfterFirstPaint(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => afterFirstPaint(() => setReady(true)), [])
  return ready
}

export function Layout() {
  useDocumentTitle()
  useStartupTasks()
  const idle = useAfterFirstPaint()
  return (
    <>
      <Header />
      <StorageBanner />
      <main id="main-content" className="app-main" tabIndex={-1}>
        <Suspense fallback={<p className="note" style={{ textAlign: 'center', marginTop: 48 }}>載入中…</p>}>
          <Outlet />
        </Suspense>
      </main>
      <Toaster />
      {idle && import.meta.env.PROD && <Suspense fallback={null}><UpdateToast /></Suspense>}
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
      <main id="main-content" className="app-main" tabIndex={-1}>
        <section className="placeholder" role="alert">
          <h1>頁面載入失敗</h1>
          <p>請確認網路後重新整理。{error?.message ? <small className="note">（{error.message}）</small> : null}</p>
          <button type="button" className="btn" onClick={() => location.reload()}>重新整理</button>
        </section>
      </main>
    </>
  )
}
