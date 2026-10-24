// 卡牌建置：合成背景、擺放主體、畫卡框文字層，交給 webgl-holo-card 的 prepare 整理圖層，
// 再輸出網站用貼圖與縮圖。
//
//   node scripts/cards/build-cards.mjs            建置全部 64 卦
//   node scripts/cards/build-cards.mjs 1 2 3 4    只建置指定卦
//
// 素材：art/raw/panels/<八卦 id>.png（3:2 紋樣面板）、art/raw/subjects/<兩位數卦序>.png（透明主體）。
// 沒有主體的卦只輸出靜態佔位卡（有框、有字、沒有插圖），網站以 art: false 標示。
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { hexagram, hexagrams } from '../../src/data/hexagrams.ts'
import { ART, BG_ZOOM, cardFaceSvg, H, SPLIT, W } from './card-face.mjs'
import { cardBackSvg } from './card-back.mjs'
import { writeQuizImage } from './quiz-images.mjs'
import { renderSvg } from './render-svg.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const HOLO = process.env.HOLO_CARD ?? join(homedir(), '.claude/skills/webgl-holo-card/scripts/holo_card.py')
const classic = JSON.parse(readFileSync(join(root, 'src/data/classic.json'), 'utf8')).hexagrams
const placements = JSON.parse(readFileSync(join(root, 'art/placements.json'), 'utf8'))
const pad = n => String(n).padStart(2, '0')

// 主體擺放的視窗：上下題框之間、以分界線為中心，四周留出背景
const WINDOW = { x: 110, y: ART.top + 30, w: 780, h: ART.bottom - ART.top - 60 }
const THUMB = { w: 400, h: 560 }

async function panelHalf(trigram) {
  const file = join(root, 'art/raw/panels', `${trigram.id}.png`)
  if (!existsSync(file)) return inkWash(trigram.color)
  // 面板當背景要退後一步：降一點飽和與亮度，讓主體浮出來
  return sharp(file).resize(W, SPLIT, { fit: 'cover' }).modulate({ saturation: 0.82, brightness: 0.86 }).png().toBuffer()
}

function inkWash(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${SPLIT}">
    <defs><radialGradient id="g" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#3a3f47"/><stop offset="1" stop-color="#16181d"/></radialGradient>
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".008" numOctaves="4" seed="11"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .22 0"/></filter></defs>
    <rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="${color}" opacity=".18"/>
    <rect width="100%" height="100%" filter="url(#n)"/></svg>`
  return Buffer.from(renderSvg(svg))
}

// 上下兩卦的分界：一條金線加細小的掐絲菱格，隨背景一起做視差
const SEAM = Buffer.from(renderSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="40">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#8d6c39"/><stop offset=".5" stop-color="#f1dfae"/><stop offset="1" stop-color="#8d6c39"/></linearGradient></defs>
  <rect y="14" width="${W}" height="12" fill="#14161b" opacity=".75"/>
  <rect y="17" width="${W}" height="2" fill="url(#g)"/><rect y="21" width="${W}" height="2" fill="url(#g)"/>
  ${Array.from({ length: 25 }, (_, i) => `<path d="M${20 + i * 40},14 l6,6 -6,6 -6,-6 Z" fill="url(#g)"/>`).join('')}
</svg>`))

const VIGNETTE = Buffer.from(renderSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><radialGradient id="v" cx=".5" cy=".45" r=".72"><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#5a5650"/></radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#v)"/></svg>`))

async function background(hex) {
  const [top, bottom] = await Promise.all([panelHalf(hex.upper), panelHalf(hex.lower)])
  return sharp({ create: { width: W, height: H, channels: 3, background: '#15171c' } })
    .composite([
      { input: top, top: 0, left: 0 },
      { input: bottom, top: SPLIT, left: 0 },
      { input: VIGNETTE, blend: 'multiply' },
      { input: SEAM, top: SPLIT - 20, left: 0 },
    ])
    .png().toBuffer()
}

// 把透明主體依 alpha 外框縮放進視窗；placements.json 可逐卡微調 scale、dx、dy
async function placeSubject(file, tweak = {}) {
  const img = sharp(file).ensureAlpha()
  const { data, info } = await img.clone().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true })
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[y * info.width + x] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1
  const scale = Math.min(WINDOW.w / bw, WINDOW.h / bh) * (tweak.scale ?? 1)
  const tw = Math.round(bw * scale), th = Math.round(bh * scale)
  const left = Math.round(WINDOW.x + (WINDOW.w - tw) / 2 + (tweak.dx ?? 0))
  const top = Math.round(WINDOW.y + (WINDOW.h - th) / 2 + (tweak.dy ?? 0))
  const cut = await img.extract({ left: x0, top: y0, width: bw, height: bh }).resize(tw, th, { kernel: 'lanczos3' }).png().toBuffer()
  // 允許稍微超出視窗，但要裁在畫布內
  const crop = { left: Math.max(0, -left), top: Math.max(0, -top) }
  const piece = await sharp(cut).extract({ ...crop, width: Math.min(tw - crop.left, W - Math.max(left, 0)), height: Math.min(th - crop.top, H - Math.max(top, 0)) }).png().toBuffer()
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: piece, left: Math.max(left, 0), top: Math.max(top, 0) }]).png().toBuffer()
}

function runHolo(step, project, extra = []) {
  const res = spawnSync('python', ['-B', HOLO, step, project, ...extra], { encoding: 'utf8' })
  const line = res.stdout.trim().split('\n').pop() || '{}'
  const out = JSON.parse(line)
  if (!out.ok) throw new Error(`holo_card ${step} 失敗：${out.error_kind} ${out.message} ${out.hint ?? ''}`)
  return out
}

async function flatten(bg, subject, text) {
  const cw = Math.round(W / BG_ZOOM), ch = Math.round(H / BG_ZOOM)
  const zoomed = await sharp(bg).extract({ left: Math.round((W - cw) / 2), top: Math.round((H - ch) / 2), width: cw, height: ch }).resize(W, H).png().toBuffer()
  const layers = [subject, text].filter(Boolean).map(input => ({ input }))
  return sharp(zoomed).composite(layers).png().toBuffer()
}

async function buildCard(n) {
  const hex = hexagram(n)
  const id = pad(n)
  const project = join(root, 'cards/holo', id)
  const web = join(root, 'public/cards', id)
  mkdirSync(join(project, 'art'), { recursive: true })
  mkdirSync(web, { recursive: true })

  const bg = await background(hex)
  const text = renderSvg(cardFaceSvg(hex, classic[n - 1]))
  const subjectFile = join(root, 'art/raw/subjects', `${id}.png`)
  const hasArt = existsSync(subjectFile)
  const webp = (buf, alpha) => sharp(buf).webp({ quality: alpha ? 88 : 84, alphaQuality: 90, effort: 5 })

  if (!hasArt) {
    const thumb = await flatten(bg, null, text)
    await webp(thumb, false).resize(THUMB.w, THUMB.h).toFile(join(web, 'thumb.webp'))
    await webp(thumb, false).toFile(join(web, 'face.webp'))
    return { number: n, art: false }
  }

  const subject = await placeSubject(subjectFile, placements[id])
  writeFileSync(join(project, 'art/background.png'), bg)
  writeFileSync(join(project, 'art/subject.png'), subject)
  writeFileSync(join(project, 'art/text.png'), text)
  writeFileSync(join(project, 'card.json'), JSON.stringify({
    mode: 'layered',
    title: hex.name,
    subtitle: hex.fullName,
    edition: `第${n}卦`,
    rarity: 'legendary',
    art: { subject: 'art/subject.png', background: 'art/background.png', text: 'art/text.png' },
    effects: { foil: 0.42, depth: 1.0, sparkle: 0.35, glow: 0.45 },
  }, null, 2))

  const prepared = runHolo('prepare', project)
  // 單張可分享的 dist/card.html；模板改自 skill 的 viewer，拿掉 shader 畫的稀有度外框
  copyFileSync(join(root, 'cards/viewer-template.html'), join(project, 'viewer-template.html'))
  runHolo('build', project, ['--template', join(project, 'viewer-template.html')])
  const layer = name => join(project, 'build/layers', `${name}.png`)
  await Promise.all([
    webp(layer('background'), false).toFile(join(web, 'background.webp')),
    webp(layer('subject'), true).toFile(join(web, 'subject.webp')),
    webp(layer('fx'), false).toFile(join(web, 'fx.webp')),
    webp(layer('text'), true).toFile(join(web, 'text.webp')),
  ])
  const flat = await flatten(bg, subject, text)
  await webp(flat, false).resize(THUMB.w, THUMB.h).toFile(join(web, 'thumb.webp'))
  await webp(flat, false).toFile(join(web, 'face.webp'))
  // 學堂看圖猜卦用：同一組背景與主體，不含卡框文字
  await writeQuizImage(web)
  return { number: n, art: true, warnings: prepared.warnings, qa: prepared.qa }
}

const requested = process.argv.slice(2).map(Number).filter(Boolean)
const targets = requested.length ? requested : hexagrams.map(h => h.number)
const manifestPath = join(root, 'src/data/cards.json')
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}
for (const n of targets) {
  const result = await buildCard(n)
  manifest[n] = { art: result.art }
  console.log(JSON.stringify(result))
}
mkdirSync(join(root, 'public/cards'), { recursive: true })
await sharp(renderSvg(cardBackSvg())).webp({ quality: 88 }).toFile(join(root, 'public/cards/back.webp'))
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n')
