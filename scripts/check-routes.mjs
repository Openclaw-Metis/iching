// 部署後檢查（AC-23）：依 src/app/routes.ts 逐一請求 102 個正式網址，確認直接回 200（不經轉址）且 <title> 為該頁標題。
//   node scripts/check-routes.mjs                          檢查正式站 https://openclaw-metis.github.io
//   node scripts/check-routes.mjs http://localhost:4173    檢查本機 npm run preview
// 需要 Node 24（直接匯入 .ts 的路徑表）。有任何一條不符就以結束碼 1 結束。
import { routes } from '../src/app/routes.ts'

const origin = (process.argv[2] ?? 'https://openclaw-metis.github.io').replace(/\/$/, '')
const base = '/iching'
const CONCURRENCY = 8

const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")

async function check(route) {
  const url = `${origin}${base}${route.path === '/' ? '/' : route.path}`
  try {
    const res = await fetch(url, { redirect: 'manual' })
    if (res.status !== 200) return { url, problem: `狀態碼 ${res.status}${res.headers.get('location') ? ` → ${res.headers.get('location')}` : ''}` }
    const title = decode(/<title>([^<]*)<\/title>/.exec(await res.text())?.[1] ?? '')
    if (title !== route.title) return { url, problem: `標題是「${title}」，應為「${route.title}」` }
    return null
  } catch (e) {
    return { url, problem: `請求失敗：${e.message}` }
  }
}

const problems = []
for (let i = 0; i < routes.length; i += CONCURRENCY) {
  const results = await Promise.all(routes.slice(i, i + CONCURRENCY).map(check))
  problems.push(...results.filter(Boolean))
}

if (problems.length) {
  for (const p of problems) console.error(`✗ ${p.url}：${p.problem}`)
  console.error(`${problems.length}／${routes.length} 條路徑有問題`)
  process.exit(1)
}
console.log(`${routes.length} 條路徑都回 200，標題正確（${origin}${base}/）`)
