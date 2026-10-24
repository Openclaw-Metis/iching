// 把《易經_周易_原文.md》拆成每卦的經傳資料，輸出 src/data/classic.json。
// 原文是經傳合一的王弼本：卦辭在標題、爻辭為粗體段落、
// 每爻之後是小象。乾卦體例不同：六爻先列，大象與小象併成一段，文言分多段。
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = readFileSync(`${root}易經_周易_原文.md`, 'utf8').replace(/\r\n/g, '\n')
const LINE_LABEL = /^(初[九六]|[九六][二三四五]|上[九六]|用[九六])，(.+)$/

function parseHexagram(heading, body) {
  const [, number, glyph, judgment] = heading.match(/^### (\d+)\. (\S) (.+)$/)
  const hex = { number: Number(number), glyph, judgment, tuan: '', daxiang: '', lines: [], wenyan: [] }
  let last = null
  let inWenyan = false
  for (const para of body.split(/\n\n+/).map(p => p.trim()).filter(Boolean)) {
    const bold = para.match(/^\*\*(.+)\*\*$/)
    if (bold && !inWenyan) {
      const m = bold[1].match(LINE_LABEL)
      if (!m) throw new Error(`第 ${number} 卦無法辨識的爻辭：${para}`)
      last = { label: m[1], text: m[2], xiang: '' }
      hex.lines.push(last)
      continue
    }
    const wy = para.match(/^(?:《文言》曰|文言曰)：(.+)$/s)
    if (wy) { inWenyan = true; hex.wenyan.push(wy[1]); continue }
    if (inWenyan) { hex.wenyan.push(para); continue }
    // 校勘註記以「\*」開頭（目前只有需卦九二小象一則），正文裡的「\*」標記一併去掉
    const note = para.match(/^\\\*(.+)$/s)
    if (note) {
      hex.notes = [...(hex.notes ?? []), note[1]]
      if (last) last.xiang = last.xiang.replace('\\*', '')
      continue
    }
    const tuan = para.match(/^《彖》曰：(.+)$/s)
    if (tuan) { hex.tuan = tuan[1]; continue }
    const xiang = para.match(/^《象》曰：(.+)$/s)
    if (xiang) {
      // 爻辭出現之前的《象》是大象；之後的是該爻小象（乾卦例外，見 fixQian）
      if (last) last.xiang = xiang[1]
      else hex.daxiang = xiang[1]
      continue
    }
    throw new Error(`第 ${number} 卦無法歸類的段落：${para.slice(0, 40)}`)
  }
  return hex
}

// 乾卦的《象》在六爻之後，且大象與七則小象寫成同一段
function fixQian(hex) {
  const xiangPara = hex.lines.at(-1).xiang
  hex.lines.at(-1).xiang = ''
  const sentences = xiangPara.split('。').filter(Boolean).map(s => s + '。')
  hex.daxiang = sentences.shift()
  if (sentences.length !== hex.lines.length) throw new Error('乾卦小象數量不符')
  hex.lines.forEach((line, i) => { line.xiang = sentences[i] })
}

const blocks = source.split(/\n(?=### \d+\. )/).slice(1)
const hexagrams = blocks.map(block => {
  const end = block.search(/\n## /)
  const text = end === -1 ? block : block.slice(0, end)
  const [heading, ...rest] = text.split('\n')
  return parseHexagram(heading.trim(), rest.join('\n').replace(/\n---\s*$/, ''))
})

const qian = hexagrams[0]
// 乾的《象》在最後一爻之後才出現，parseHexagram 會把它當成用九的小象
if (!qian.daxiang) fixQian(qian)

const problems = []
hexagrams.forEach((h, i) => {
  if (h.number !== i + 1) problems.push(`卦序錯位：第 ${i + 1} 筆是 ${h.number}`)
  const expected = h.number <= 2 ? 7 : 6
  if (h.lines.length !== expected) problems.push(`第 ${h.number} 卦有 ${h.lines.length} 爻`)
  if (!h.tuan) problems.push(`第 ${h.number} 卦缺彖`)
  if (!h.daxiang) problems.push(`第 ${h.number} 卦缺大象`)
  h.lines.forEach(l => { if (!l.xiang) problems.push(`第 ${h.number} 卦 ${l.label} 缺小象`) })
})
if (hexagrams.length !== 64) problems.push(`共 ${hexagrams.length} 卦`)
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

const out = `${root}src/data/classic.json`
writeFileSync(out, JSON.stringify({
  source: '易經_周易_原文.md（底本為王弼《周易注》）',
  hexagrams,
}, null, 1) + '\n')
console.log(`ok: ${hexagrams.length} 卦 → ${out}`)
