import { copyFileSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
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

// 記錄卦殿首屏會載入的 chunk：從 entry 遞迴走訪靜態匯入（動態匯入不算），供 scripts/build/check-size.mjs 檢查
function firstScreenReport(): Plugin {
  return {
    name: 'iching-first-screen',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = new Map<string, string[]>()
      const visit = (fileName: string) => {
        const chunk = bundle[fileName]
        if (!chunk || chunk.type !== 'chunk' || chunks.has(fileName)) return
        chunks.set(fileName, chunk.moduleIds)
        for (const dep of chunk.imports) visit(dep)
      }
      for (const item of Object.values(bundle)) if (item.type === 'chunk' && item.isEntry) visit(item.fileName)
      const report = { chunks: [...chunks].map(([fileName, moduleIds]) => ({ fileName, moduleIds })) }
      this.emitFile({ type: 'asset', fileName: 'first-screen.json', source: JSON.stringify(report, null, 1) })
    },
  }
}

export default defineConfig(({ command, isPreview }) => ({
  // 正式版部署在 https://openclaw-metis.github.io/iching/；本機開發維持根路徑，vite preview 比照正式版
  base: command === 'build' || isPreview ? '/iching/' : '/',
  plugins: [react(), contentSecurityPolicy(), firstScreenReport(), staticPages(), pruneUnusedFaces()],
  server: { port: 5181 },
}))
