import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { checkFirstScreen, LIMIT_BYTES } from '../../scripts/build/check-size.mjs'
import { filesFor, writeRoutePages } from '../../scripts/build/route-pages.mjs'
import { routes } from './routes.ts'

const dirs: string[] = []
const tempDist = () => {
  const d = mkdtempSync(join(tmpdir(), 'iching-dist-'))
  dirs.push(d)
  return d
}
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }) })

const TEMPLATE = '<!doctype html><html><head><meta charset="utf-8"><meta name="description" content="預設"><title>易經卦殿</title></head><body></body></html>'

describe('route-pages（TC-19）', () => {
  it('102 條路徑都有對應的 HTML，標題與描述正確', () => {
    const dist = tempDist()
    writeFileSync(join(dist, 'index.html'), TEMPLATE)
    const result = writeRoutePages(dist)
    expect(result.routes).toBe(102)
    for (const route of routes) {
      for (const file of filesFor(route.path)) {
        const html = readFileSync(join(dist, file), 'utf8')
        expect(html).toContain(`<title>${route.title}</title>`)
      }
    }
    expect(readFileSync(join(dist, 'gua/3.html'), 'utf8')).toContain('<meta name="description" content="屯・水雷屯：')
  })

  it('同時是目錄的路徑另寫 index.html，其他路徑只寫同名 .html', () => {
    expect(filesFor('/')).toEqual(['index.html'])
    expect(filesFor('/gua/3')).toEqual(['gua/3.html'])
    expect(filesFor('/academy')).toEqual(['academy.html', 'academy/index.html'])
    expect(filesFor('/academy/review')).toEqual(['academy/review.html'])
  })
})

describe('check-size', () => {
  const fixture = (moduleIds: string[], bytes = 1000) => {
    const dist = tempDist()
    mkdirSync(join(dist, 'assets'))
    // 亂數內容幾乎不能壓縮，gzip 後的大小接近原始大小
    writeFileSync(join(dist, 'assets/index.js'), Buffer.from(Array.from({ length: bytes }, () => Math.floor(Math.random() * 256))))
    writeFileSync(join(dist, 'first-screen.json'), JSON.stringify({ chunks: [{ fileName: 'assets/index.js', moduleIds }] }))
    return dist
  }

  it('首屏沒有禁用模組且在上限內時通過', () => {
    expect(checkFirstScreen(fixture(['/repo/src/pages/Hall.tsx', '/repo/node_modules/react/index.js'])).ok).toBe(true)
  })

  it('首屏帶到保存層、功能模組、Dexie 或 ts-fsrs 時失敗', () => {
    for (const id of ['/repo/src/storage/db.ts', '/repo/src/features/divination/index.ts', '/repo/node_modules/dexie/dist/dexie.mjs', '/repo/node_modules/ts-fsrs/dist/index.mjs']) {
      const r = checkFirstScreen(fixture([id]))
      expect(r.ok).toBe(false)
      expect(r.violations).toHaveLength(1)
    }
  })

  it('超過 160 KB 時失敗', () => {
    expect(checkFirstScreen(fixture([], LIMIT_BYTES + 4096)).ok).toBe(false)
  })
})
