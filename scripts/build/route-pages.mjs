// 建置後依 src/app/routes.ts 替每條路徑寫一份靜態 HTML，直接開啟 /iching/gua/3 這類網址時回 200，
// 而且分頁標題與描述就是該頁的內容（之前只靠 404.html 備援，狀態碼是 404）。
//
// 檔名用 <路徑>.html：GitHub Pages 對不帶副檔名的網址會直接回應同名 .html；若寫成 <路徑>/index.html，
// Pages 會先 301 轉到結尾斜線。路徑本身也是目錄時（/academy 底下還有課程與考核），另寫一份 <路徑>/index.html，
// 不論 Pages 先看哪一個，最後都是 200。
//
// 可以單獨執行：node scripts/build/route-pages.mjs [dist 目錄]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { routes } from '../../src/app/routes.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function describe(route, content) {
  if (!route.hexagram) return route.description
  const c = content[route.hexagram]
  return c ? `${route.title.split('｜')[0]}：${c.motto}` : route.description
}

/** 依 Pages 的解析方式，回傳某條路徑對應的檔案（相對 dist） */
export function filesFor(path, allPaths = routes.map(r => r.path)) {
  if (path === '/') return ['index.html']
  const rel = path.slice(1)
  const isDirectory = allPaths.some(p => p.startsWith(`${path}/`))
  return isDirectory ? [`${rel}.html`, `${rel}/index.html`] : [`${rel}.html`]
}

export function writeRoutePages(outDir = join(root, 'dist')) {
  const template = readFileSync(join(outDir, 'index.html'), 'utf8')
  if (!/<title>[^<]*<\/title>/.test(template) || !/<meta name="description" content="[^"]*">/.test(template)) {
    throw new Error('dist/index.html 找不到 <title> 或 meta description，無法產生各路徑頁面')
  }
  const content = JSON.parse(readFileSync(join(root, 'src/data/content.json'), 'utf8'))
  let written = 0
  for (const route of routes) {
    const html = template
      .replace(/<title>[^<]*<\/title>/, `<title>${escape(route.title)}</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escape(describe(route, content))}">`)
    for (const file of filesFor(route.path)) {
      const target = join(outDir, file)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, html)
      written++
    }
  }
  return { routes: routes.length, files: written }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = writeRoutePages(process.argv[2] ? resolve(process.argv[2]) : undefined)
  console.log(`route-pages：${result.routes} 條路徑，寫出 ${result.files} 個檔案`)
}
