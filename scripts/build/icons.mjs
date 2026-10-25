// 由品牌圖示 public/favicon.svg 產生加到主畫面用的圖示（PWA manifest 與 iOS apple-touch-icon）。
//   node scripts/build/icons.mjs
// maskable 版本四周留安全區（Android 會裁成圓形或圓角方形），安裝圖示使用墨黑底。
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('../../', import.meta.url))
const svg = readFileSync(join(root, 'public/favicon.svg'))
const out = join(root, 'public/icons')
const INK = '#10100f'
mkdirSync(out, { recursive: true })

// 網站品牌保持透明，只有安裝用 PNG 補底，避免作業系統自行填色。
const render = size => sharp(svg, { density: Math.ceil((72 * size) / 64) }).resize(size, size).flatten({ background: INK }).png()

await render(192).toFile(join(out, 'icon-192.png'))
await render(512).toFile(join(out, 'icon-512.png'))
await render(180).toFile(join(out, 'apple-touch-icon.png'))
// 方印縮到 80%，連同描邊留在中央半徑 40% 的安全圓內，圓形裁切也保留六爻。
const inner = await render(410).toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: INK } })
  .composite([{ input: inner, left: 51, top: 51 }])
  .png()
  .toFile(join(out, 'icon-maskable-512.png'))
console.log('icons 完成')
