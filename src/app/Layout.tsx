import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useRouteError } from 'react-router'
import { afterFirstPaint } from './idle.ts'
import { NAV_ITEMS } from './nav.ts'
import { useRouteFocus } from './routeFocus.ts'
import { titleFor } from './routes.ts'
import { StorageBanner } from './StorageBanner.tsx'
import { Toaster } from './Toaster.tsx'
import { APP_VERSION } from './version.ts'
import { Drawer } from '../components/Drawer.tsx'
import { LineForge } from '../components/LineForge.tsx'

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
          <button type="button" className="icon-button menu-toggle" aria-label="選單" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
      </header>
      <Drawer open={menuOpen} title={<><img className="mobile-menu-mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={44} height={44} /><span className="sr-only">主選單</span></>} iconOnlyClose onClose={() => setMenuOpen(false)}>
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

const pageName = (pathname: string) => titleFor(pathname).split('｜')[0]
const EMPTY_LINES = Array.from({ length: 6 }, () => ({ bit: null }))

/** 延遲載入時的骨架：頁面名稱與六個空爻位，換上內容時版面不會從一行字跳成整頁 */
function RouteLoading() {
  const { pathname } = useLocation()
  return (
    <div className="route-loading" aria-busy="true">
      <p className="route-loading-title">{pageName(pathname)}</p>
      <LineForge lines={EMPTY_LINES} label="載入中" still />
    </div>
  )
}

// 同一次瀏覽中再次進入同一路徑時只淡入、不位移（規格「2026-10-29 介面檢視後修訂」）。
// 以 location.key 記住結果，StrictMode 重複渲染也得到同樣答案
const seenPaths = new Set<string>()
const revisitByKey = new Map<string, boolean>()
function isRevisit(key: string, pathname: string) {
  if (!revisitByKey.has(key)) {
    revisitByKey.set(key, seenPaths.has(pathname))
    seenPaths.add(pathname)
  }
  return revisitByKey.get(key)!
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <Link to="/me?tab=settings#guide">使用說明</Link>
        <span>資料只存在這台裝置</span>
        <span>經文底本：王弼《周易注》</span>
        <Link to="/gua/1?tab=source">卡面插圖說明</Link>
        <span>版本 {APP_VERSION}</span>
      </div>
    </footer>
  )
}

export function Layout() {
  useDocumentTitle()
  useStartupTasks()
  const idle = useAfterFirstPaint()
  const announce = useRouteFocus()
  const location = useLocation()
  return (
    <>
      <Header />
      <StorageBanner />
      <main id="main-content" className="app-main" tabIndex={-1} data-revisit={isRevisit(location.key, location.pathname) || undefined}>
        <Suspense fallback={<RouteLoading />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announce}</p>
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
