// 看圖猜卦用的 quiz.webp（規格「學堂內容設計」的 image-to-name）：比照 build-cards.mjs 的 flatten()，
// 背景依 BG_ZOOM 放大置中，再疊上主體，不加卡框文字層，輸出 300×420（5:7）。
//
//   node scripts/cards/quiz-images.mjs          由 public/cards/NN 的圖層產生全部 64 張
//   node scripts/cards/quiz-images.mjs 3 4      只產生指定卦
//
// build-cards.mjs 輸出網站貼圖時也會呼叫 writeQuizImage，重建卡牌不會遺漏。
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { BG_ZOOM, H, W } from './card-face.mjs'

export const QUIZ = { w: 300, h: 420 }

/** dir 內要有 background.webp 與 subject.webp（1000×1400 的對齊圖層） */
export async function writeQuizImage(dir) {
  const cw = Math.round(W / BG_ZOOM), ch = Math.round(H / BG_ZOOM)
  const zoomed = await sharp(join(dir, 'background.webp'))
    .extract({ left: Math.round((W - cw) / 2), top: Math.round((H - ch) / 2), width: cw, height: ch })
    .resize(W, H).png().toBuffer()
  const subject = await sharp(join(dir, 'subject.webp')).png().toBuffer()
  // sharp 在同一條管線裡會先縮放再疊圖，所以疊好之後另開一次再縮小
  const flat = await sharp(zoomed).composite([{ input: subject }]).png().toBuffer()
  await sharp(flat).resize(QUIZ.w, QUIZ.h).webp({ quality: 82, effort: 5 }).toFile(join(dir, 'quiz.webp'))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const requested = process.argv.slice(2).map(Number).filter(Boolean)
  const targets = requested.length ? requested : Array.from({ length: 64 }, (_, i) => i + 1)
  for (const n of targets) {
    const dir = join(root, 'public/cards', String(n).padStart(2, '0'))
    if (!existsSync(join(dir, 'subject.webp'))) {
      console.warn(`第 ${n} 卦沒有主體圖層，略過`)
      continue
    }
    await writeQuizImage(dir)
  }
  console.log(`quiz.webp 完成 ${targets.length} 張`)
}
