// 卦殿首屏的體積與模組檢查（規格「非功能需求：效能」）。
// 建置時 vite.config.ts 從 entry chunk 遞迴走訪靜態匯入，把首屏 chunk 的檔名與 moduleIds 寫到 dist/first-screen.json；
// 這裡去重後加總 gzip 大小，超過上限，或首屏帶到保存層、功能模組、Dexie、ts-fsrs 時以非零碼結束。動態匯入不計入。
//
// 用法：node scripts/build/check-size.mjs [dist 目錄]

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

export const LIMIT_BYTES = 160 * 1024
// 延遲載入頁面自身的程式包（扣掉首屏已載入的部分，不含 three）
export const PAGE_LIMITS = { divine: 120 * 1024 }
const isThree = id => /[\\/]node_modules[\\/]three[\\/]/.test(id)
export const FORBIDDEN = [
  { label: 'src/storage', test: id => /[\\/]src[\\/]storage[\\/]/.test(id) },
  { label: 'src/features', test: id => /[\\/]src[\\/]features[\\/]/.test(id) },
  { label: 'dexie', test: id => /[\\/]node_modules[\\/](dexie|dexie-react-hooks|fake-indexeddb)[\\/]/.test(id) },
  { label: 'ts-fsrs', test: id => /[\\/]node_modules[\\/]ts-fsrs[\\/]/.test(id) },
]

export function checkFirstScreen(distDir) {
  const report = JSON.parse(readFileSync(join(distDir, 'first-screen.json'), 'utf8'))
  const files = [...new Set(report.chunks.map(c => c.fileName))]
  const sizes = files.map(f => ({ file: f, gzip: gzipSync(readFileSync(join(distDir, f))).length }))
  const total = sizes.reduce((sum, s) => sum + s.gzip, 0)
  const violations = []
  for (const chunk of report.chunks) {
    for (const id of chunk.moduleIds) {
      for (const rule of FORBIDDEN) if (rule.test(id)) violations.push(`${chunk.fileName} 含 ${rule.label}：${id}`)
    }
  }
  const pages = Object.entries(report.pages ?? {}).map(([page, chunks]) => {
    const own = chunks.filter(c => !c.moduleIds.every(isThree))
    const bytes = own.reduce((sum, c) => sum + gzipSync(readFileSync(join(distDir, c.fileName))).length, 0)
    return { page, bytes, limit: PAGE_LIMITS[page] ?? Infinity }
  })
  const pagesOk = pages.every(p => p.bytes <= p.limit)
  return { sizes, total, violations, pages, ok: total <= LIMIT_BYTES && violations.length === 0 && pagesOk }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = process.argv[2] ? resolve(process.argv[2]) : resolve(dirname(fileURLToPath(import.meta.url)), '../../dist')
  const { sizes, total, violations, pages, ok } = checkFirstScreen(dist)
  for (const s of sizes) console.log(`  ${s.file}  ${(s.gzip / 1024).toFixed(1)} KB`)
  console.log(`卦殿首屏 JavaScript（gzip）：${(total / 1024).toFixed(1)} KB／上限 ${LIMIT_BYTES / 1024} KB`)
  for (const p of pages) {
    console.log(`${p.page} 頁自身程式包（gzip，不含 three）：${(p.bytes / 1024).toFixed(1)} KB／上限 ${p.limit / 1024} KB`)
    if (p.bytes > p.limit) console.error(`${p.page} 頁超過體積上限`)
  }
  for (const v of violations) console.error(`首屏不得包含：${v}`)
  if (!ok) {
    if (total > LIMIT_BYTES) console.error('首屏超過體積上限')
    process.exit(1)
  }
}
