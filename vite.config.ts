import { copyFileSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { writeRoutePages } from './scripts/build/route-pages.mjs'

// GitHub Pages 不支援單頁應用的路由：不在路徑表裡的網址（打錯的、舊的）會落到 404.html，
// 由前端路由顯示「找不到這一頁」。路徑表裡的頁面另由 route-pages 產生各自的 HTML，直接開啟就是 200。
function staticPages(): Plugin {
  let outDir = 'dist'
  return {
    name: 'iching-static-pages',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir) },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
      writeRoutePages(outDir)
    },
  }
}

// 只在正式建置注入 CSP：開發模式下 React 熱更新會插入內嵌腳本，被 script-src 'self' 擋掉
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "script-src 'self'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'iching-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="${CSP}">`)
    },
  }
}

// 已有插圖的卡，網站用分層貼圖顯示，整張的 face.webp 用不到（每張約 0.3 MB），不放進部署包
function pruneUnusedFaces(): Plugin {
  let outDir = 'dist'
  return {
    name: 'iching-prune-faces',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir) },
    closeBundle() {
      const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, 'src/data/cards.json'), 'utf8')) as Record<string, { art: boolean }>
      for (const [n, card] of Object.entries(manifest)) {
        if (card.art) rmSync(resolve(outDir, 'cards', n.padStart(2, '0'), 'face.webp'), { force: true })
      }
    },
  }
}

// 記錄卦殿首屏會載入的 chunk：從 entry 遞迴走訪靜態匯入（動態匯入不算），供 scripts/build/check-size.mjs 檢查。
// 另記錄有體積上限的延遲載入頁面（占卜頁）：該頁 chunk 加上它的靜態匯入，扣掉首屏已載入的部分
const BUDGET_PAGES = { divine: 'src/pages/Divine.tsx' }

function firstScreenReport(): Plugin {
  return {
    name: 'iching-first-screen',
    apply: 'build',
    generateBundle(_options, bundle) {
      const collect = (start: string, into: Map<string, string[]>, skip = new Set<string>()) => {
        const visit = (fileName: string) => {
          const chunk = bundle[fileName]
          if (!chunk || chunk.type !== 'chunk' || into.has(fileName) || skip.has(fileName)) return
          into.set(fileName, chunk.moduleIds)
          for (const dep of chunk.imports) visit(dep)
        }
        visit(start)
        return into
      }
      const first = new Map<string, string[]>()
      for (const item of Object.values(bundle)) if (item.type === 'chunk' && item.isEntry) collect(item.fileName, first)
      const pages: Record<string, { fileName: string; moduleIds: string[] }[]> = {}
      for (const [page, source] of Object.entries(BUDGET_PAGES)) {
        const chunk = Object.values(bundle).find(c => c.type === 'chunk' && c.facadeModuleId?.endsWith(source))
        if (!chunk) continue
        const files = collect(chunk.fileName, new Map(), new Set(first.keys()))
        pages[page] = [...files].map(([fileName, moduleIds]) => ({ fileName, moduleIds }))
      }
      const report = { chunks: [...first].map(([fileName, moduleIds]) => ({ fileName, moduleIds })), pages }
      this.emitFile({ type: 'asset', fileName: 'first-screen.json', source: JSON.stringify(report, null, 1) })
    },
  }
}

// 離線版（規格 Stage 9）：預先快取網站外殼、全部程式與白話、64 張縮圖與看圖卡；卡圖四層與字型在用到時才快取。
// 註冊由 UpdateToast 以 virtual:pwa-register 進行（打包在程式裡，不用內嵌腳本，CSP 照常）；有新版本時由使用者按重新整理才更新。
// 各路徑的 HTML（route-pages）不預先快取：離線時的導覽一律回 index.html，由前端路由接手。
const pwa = () => VitePWA({
  registerType: 'prompt',
  injectRegister: false,
  manifest: {
    name: '易經卦殿',
    short_name: '易經卦殿',
    description: '易經六十四卦卦牌：占卜、每日一卦、學堂與收藏，資料只存在這台裝置。',
    lang: 'zh-Hant',
    start_url: '/iching/',
    scope: '/iching/',
    display: 'standalone',
    background_color: '#0c0d10',
    theme_color: '#0c0d10',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    // manifest 的圖示由外掛自動加入預先快取，這裡不重複列
    globPatterns: ['index.html', 'assets/**/*.{js,css,json}', 'cards/*/thumb.webp', 'cards/*/quiz.webp', 'cards/back.webp', 'icons/apple-touch-icon.png', 'favicon.svg'],
    // 卡牌頁的 chunk 含 three，約 0.6 MB
    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
    navigateFallback: '/iching/index.html',
    navigateFallbackAllowlist: [/^\/iching\//],
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        // 卡圖四層：最近看過的 30 卦由 src/app/cardCache.ts 整理，這裡不設上限
        urlPattern: /\/iching\/cards\/\d{2}\/(background|subject|fx|text)\.webp$/,
        handler: 'CacheFirst',
        options: { cacheName: 'card-layers' },
      },
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'google-fonts-css' },
      },
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
        handler: 'CacheFirst',
        options: { cacheName: 'google-fonts', cacheableResponse: { statuses: [0, 200] }, expiration: { maxAgeSeconds: 365 * 24 * 60 * 60 } },
      },
    ],
  },
})

export default defineConfig(({ command, isPreview }) => ({
  // 正式版部署在 https://openclaw-metis.github.io/iching/；本機開發維持根路徑，vite preview 比照正式版
  base: command === 'build' || isPreview ? '/iching/' : '/',
  plugins: [react(), contentSecurityPolicy(), firstScreenReport(), staticPages(), pruneUnusedFaces(), pwa()],
  server: { port: 5181 },
}))
