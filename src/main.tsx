import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, NavLink, Outlet, RouterProvider, ScrollRestoration } from 'react-router'
import { Hall } from './pages/Hall.tsx'
import './styles/global.css'

// 詳細頁帶 Three.js，分開載入，讓卦殿先出現
const CardDetail = lazy(() => import('./pages/CardDetail.tsx').then(m => ({ default: m.CardDetail })))

function Layout() {
  return (
    <>
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
          <NavLink to="/" end>卦殿</NavLink>
        </nav>
      </header>
      <main>
        <Suspense fallback={<p className="note" style={{ textAlign: 'center', marginTop: 48 }}>載入中…</p>}>
          <Outlet />
        </Suspense>
      </main>
      <ScrollRestoration />
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Hall /> },
      { path: 'gua/:number', element: <CardDetail /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
