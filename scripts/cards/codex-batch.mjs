// 由 src/data/art-direction.json 產生給互動式 Codex 讀的批次提示檔。
// Codex 讀這份 markdown 後依序呼叫 image_gen，每張只生成一次並存到指定路徑。
//
//   node scripts/cards/codex-batch.mjs <輸出資料夾> <批次名> panel:dui 5 6 7 ...
//
// 終端只收單行 ASCII，所以提示詞放在檔案裡，啟動 Codex 時只叫它讀這個檔。
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const art = JSON.parse(readFileSync(join(root, 'src/data/art-direction.json'), 'utf8'))
const [outDir, batch, ...items] = process.argv.slice(2)
if (!outDir || !batch || !items.length) {
  console.error('用法：node scripts/cards/codex-batch.mjs <輸出資料夾> <批次名> panel:<八卦id> <卦序> ...')
  process.exit(1)
}

const NO_TEXT = 'No text, no letters, no calligraphy, no seal characters, no border, no frame, no watermark.'
const entries = items.map(item => {
  if (item.startsWith('panel:')) {
    const id = item.slice(6)
    if (!art.panels[id]) throw new Error(`沒有面板 ${id}`)
    return {
      path: join(outDir, `panel-${id}.png`),
      mode: 'OPAQUE, landscape 3:2 (1536x1024)',
      prompt: `${art.panels[id]}. ${art.panelStyle}. Landscape 3:2 composition, an evenly distributed all over decorative pattern that fills the whole canvas edge to edge with no single focal object and mid tone overall brightness. No characters, no people, no animals, no birds, no dragons. No trigram or hexagram line symbols. ${NO_TEXT}`,
    }
  }
  const s = art.subjects[item]
  if (!s) throw new Error(`沒有第 ${item} 卦的畫面設計`)
  return {
    path: join(outDir, `subject-${String(item).padStart(2, '0')}.png`),
    mode: 'TRANSPARENT, portrait 2:3 (1024x1536)',
    // 人物規則對動物、器物主體沒有影響，所以一律附上，避免畫出西方人物
    prompt: `${s.en}. ${art.style}. ${art.peopleRule}. Vertical portrait 2:3 composition, the whole subject inside the central 80 percent of the canvas, centered both horizontally and vertically, with an empty transparent margin on every side. ${NO_TEXT}`,
  }
})

const skipped = entries.filter(e => existsSync(e.path)).map(e => e.path)
const todo = entries.filter(e => !existsSync(e.path))
const md = `# Image batch ${batch}

Process every entry below in order, one after another, without asking for confirmation.

For each entry:
1. Call your image_gen tool exactly once with the entry prompt.
2. TRANSPARENT entries: set the image tool background or transparency option to transparent and save a PNG with a real alpha channel. Never paint a checkerboard pattern or any background color.
3. OPAQUE entries: a normal full canvas image.
4. Save the result to the entry path. Do not overwrite a file that already exists.

Never edit, retry or regenerate an image, even if you think it could be better. If a generation fails, write FAILED next to that entry in your reply and continue with the next entry. Do not open, inspect or describe the saved images. After the last entry, print the list of saved paths.

${todo.map((e, i) => `## ${i + 1}. ${e.path}

- Mode: ${e.mode}
- Prompt: ${e.prompt}
`).join('\n')}`

const file = join(outDir, `batch-${batch}.md`)
writeFileSync(file, md)
console.log(JSON.stringify({ file, entries: todo.length, skipped }))
