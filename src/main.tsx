import { StrictMode, lazy, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { Layout, RouteError } from './app/Layout.tsx'
import { PATTERNS, type PageId } from './app/routes.ts'
import { Hall } from './pages/Hall.tsx'
import './styles/global.css'

// 卦殿以外的頁面一律延遲載入，卦殿首屏才不會帶到 three、保存層與功能模組
const placeholder = lazy(() => import('./app/ComingSoon.tsx').then(m => ({ default: m.ComingSoon })))
const NotFound = lazy(() => import('./app/ComingSoon.tsx').then(m => ({ default: m.NotFound })))

const PAGES: Record<PageId, ComponentType> = {
  hall: Hall,
  card: lazy(() => import('./pages/CardDetail.tsx').then(m => ({ default: m.CardDetail }))),
  today: lazy(() => import('./pages/Today.tsx').then(m => ({ default: m.Today }))),
  divine: lazy(() => import('./pages/Divine.tsx').then(m => ({ default: m.Divine }))),
  academy: placeholder,
  me: lazy(() => import('./pages/Me.tsx').then(m => ({ default: m.Me }))),
  lesson: placeholder,
  exam: placeholder,
  review: placeholder,
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      ...(Object.entries(PATTERNS) as [PageId, string][]).map(([page, path]) => {
        const Page = PAGES[page]
        return path === '/' ? { index: true, element: <Page /> } : { path: path.slice(1), element: <Page /> }
      }),
      { path: '*', element: <NotFound /> },
    ],
  },
], { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

// 開發用示範資料（網址帶 ?seed=demo）；正式建置時 import.meta.env.DEV 為 false，整段會被移除
if (import.meta.env.DEV) void import('./storage/seed.ts').then(m => m.seedIfRequested())
