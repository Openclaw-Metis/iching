// 卡面框與文字圖層（1000×1400，5:7，對應 webgl-holo-card 的畫布）。
// 中央插圖區保持透明；框線、上下卦色帶、題名牌與朱印都畫在這一層。
// resvg 不支援可變字型的字重軸，標題以同色描邊加粗。

export const W = 1000
export const H = 1400
/** 上下卦背景的分界（卡面像素） */
export const SPLIT = 700

const GOLD = '#c9a96b'
const IVORY = '#f1e8d4'
const INK = '#121419'
const VERMILION = '#a3402c'
const FONT = "'Noto Serif TC'"

const NUMERALS = '一二三四五六七八九'
export function chineseNumeral(n) {
  if (n < 10) return NUMERALS[n - 1]
  const tens = Math.floor(n / 10), ones = n % 10
  return `${tens > 1 ? NUMERALS[tens - 1] : ''}十${ones ? NUMERALS[ones - 1] : ''}`
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

function text(x, y, content, { size, fill = IVORY, weight = 0, spacing = 0, anchor = 'middle', opacity = 1, filter = '' }) {
  const stroke = weight ? ` stroke="${fill}" stroke-width="${weight}" stroke-linejoin="round" paint-order="stroke"` : ''
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" fill="${fill}"${stroke} letter-spacing="${spacing}" text-anchor="${anchor}" opacity="${opacity}"${filter ? ` filter="url(#${filter})"` : ''}>${esc(content)}</text>`
}

/** 六爻卦畫，由上而下畫第六爻到初爻 */
export function hexagramFigure(lines, { x, y, width, bar, gap, fill, stroke = '' }) {
  const half = (width - bar * 1.8) / 2
  const out = []
  for (let i = 0; i < 6; i++) {
    const bit = lines[5 - i]
    const top = y + i * (bar + gap)
    const attrs = `fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="1"` : ''}`
    if (bit) out.push(`<rect x="${x}" y="${top}" width="${width}" height="${bar}" rx="1.5" ${attrs}/>`)
    else out.push(
      `<rect x="${x}" y="${top}" width="${half}" height="${bar}" rx="1.5" ${attrs}/>`,
      `<rect x="${x + width - half}" y="${top}" width="${half}" height="${bar}" rx="1.5" ${attrs}/>`,
    )
  }
  return out.join('')
}

// 外框色帶：上半用上卦色、下半用下卦色，中間以金色細格分成掐絲琺瑯的小格
function enamelBand(upper, lower) {
  const o = 26, i = 50
  const ring = `M${o + 22},${o} H${W - o - 22} Q${W - o},${o} ${W - o},${o + 22} V${H - o - 22} Q${W - o},${H - o} ${W - o - 22},${H - o} H${o + 22} Q${o},${H - o} ${o},${H - o - 22} V${o + 22} Q${o},${o} ${o + 22},${o} Z `
    + `M${i + 10},${i} H${W - i - 10} Q${W - i},${i} ${W - i},${i + 10} V${H - i - 10} Q${W - i},${H - i} ${W - i - 10},${H - i} H${i + 10} Q${i},${H - i} ${i},${H - i - 10} V${i + 10} Q${i},${i} ${i + 10},${i} Z`
  const cells = []
  for (let y = 96; y < H - 70; y += 46) cells.push(`M${o},${y} H${i} M${W - i},${y} H${W - o}`)
  for (let x = 96; x < W - 70; x += 46) cells.push(`M${x},${o} V${i} M${x},${H - i} V${H - o}`)
  return `
  <clipPath id="top"><rect x="0" y="0" width="${W}" height="${SPLIT}"/></clipPath>
  <clipPath id="bottom"><rect x="0" y="${SPLIT}" width="${W}" height="${H - SPLIT}"/></clipPath>
  <path d="${ring}" fill="${upper.color}" fill-rule="evenodd" clip-path="url(#top)"/>
  <path d="${ring}" fill="${lower.color}" fill-rule="evenodd" clip-path="url(#bottom)"/>
  <path d="${ring}" fill="url(#enamelShade)" fill-rule="evenodd"/>
  <path d="${cells.join(' ')}" stroke="url(#gold)" stroke-width="2" opacity=".9"/>
  <path d="${ring}" fill="none" stroke="url(#gold)" stroke-width="3" fill-rule="evenodd"/>
  <line x1="${o}" y1="${SPLIT}" x2="${i}" y2="${SPLIT}" stroke="url(#gold)" stroke-width="3"/>
  <line x1="${W - i}" y1="${SPLIT}" x2="${W - o}" y2="${SPLIT}" stroke="url(#gold)" stroke-width="3"/>`
}

function corner(cx, cy, color) {
  return `<g transform="translate(${cx} ${cy})">
    <rect x="-24" y="-24" width="48" height="48" rx="4" fill="${INK}" stroke="url(#gold)" stroke-width="3"/>
    <rect x="-16" y="-16" width="32" height="32" fill="none" stroke="${GOLD}" stroke-width="1" opacity=".7"/>
    <circle r="11" fill="${color}" stroke="url(#gold)" stroke-width="2.5"/>
    <circle r="3.5" fill="url(#gold)"/>
  </g>`
}

function medallion(cx, cy, color, label) {
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="27" fill="${color}" stroke="url(#gold)" stroke-width="4"/>
    <circle cx="${cx}" cy="${cy}" r="21" fill="none" stroke="${IVORY}" stroke-width="1" opacity=".45"/>
    ${text(cx, cy + 10, label, { size: 28, weight: 1.1 })}
  </g>`
}

function cartouche(number) {
  const label = chineseNumeral(number)
  return `<g>
    <path d="M392,58 L416,26 H584 L608,58 L584,90 H416 Z" fill="${INK}" fill-opacity=".94" stroke="url(#gold)" stroke-width="3.5"/>
    <path d="M404,58 L423,33 H577 L596,58 L577,83 H423 Z" fill="none" stroke="${GOLD}" stroke-width="1" opacity=".7"/>
    <circle cx="382" cy="58" r="4" fill="url(#gold)"/><circle cx="618" cy="58" r="4" fill="url(#gold)"/>
    ${text(500, 71, label, { size: label.length > 2 ? 32 : 36, fill: 'url(#gold)', weight: 1, spacing: label.length > 2 ? 2 : 6 })}
  </g>`
}

function seal(cx, cy, name) {
  const s = 86
  const chars = [...name]
  const glyphs = chars.length === 1
    ? text(cx, cy + 19, name, { size: 54, fill: '#f6eee0', weight: 1.4 })
    : chars.map((c, k) => text(cx, cy - 4 + k * 38, c, { size: 36, fill: '#f6eee0', weight: 1.2 })).join('')
  return `<g filter="url(#rough)">
    <rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" rx="5" fill="${VERMILION}"/>
    <rect x="${cx - s / 2 + 6}" y="${cy - s / 2 + 6}" width="${s - 12}" height="${s - 12}" rx="2" fill="none" stroke="#f6eee0" stroke-width="2" opacity=".85"/>
    ${glyphs}
  </g>`
}

function titlePlaque(hex, classic) {
  const outer = 'M68,1338 V1050 C68,1024 92,1014 122,1013 L412,1013 C452,1013 472,994 500,982 C528,994 548,1013 588,1013 L878,1013 C908,1014 932,1024 932,1050 V1338 Z'
  const inner = 'M80,1326 V1054 C80,1034 98,1025 124,1024 L415,1024 C455,1024 476,1006 500,995 C524,1006 545,1024 585,1024 L876,1024 C902,1025 920,1034 920,1054 V1326 Z'
  const [image, moral] = splitDaxiang(classic.daxiang)
  const cx = 515
  const nameSize = hex.name.length === 1 ? 104 : 84
  return `<g>
    <path d="${outer}" fill="url(#plaque)" stroke="url(#gold)" stroke-width="3.5"/>
    <path d="${inner}" fill="none" stroke="${GOLD}" stroke-width="1" opacity=".65"/>
    <path d="M500,970 L510,982 L500,994 L490,982 Z" fill="url(#gold)"/>
    ${hexagramFigure(hex.lines, { x: 110, y: 1104, width: 118, bar: 13, gap: 11, fill: 'url(#gold)', stroke: '#5b4626' })}
    ${text(169, 1272, `${hex.upper.name}上${hex.lower.name}下`, { size: 20, fill: GOLD, spacing: 3, opacity: 0.9 })}
    ${text(cx, 1080, hex.fullName, { size: 26, fill: GOLD, spacing: 10, weight: 0.4 })}
    ${text(cx, 1186, hex.name, { size: nameSize, fill: 'url(#goldText)', weight: 2.4, spacing: hex.name.length > 1 ? 6 : 0, filter: 'lift' })}
    <path d="M395,1220 H492 M538,1220 H635" stroke="${GOLD}" stroke-width="1.2" opacity=".8"/>
    <path d="M515,1212 L523,1220 L515,1228 L507,1220 Z" fill="url(#gold)"/>
    ${text(cx, 1266, image, { size: 25, spacing: 3, opacity: 0.92, weight: 0.3 })}
    ${moral ? text(cx, 1304, moral, { size: 23, spacing: 2, opacity: 0.78 }) : ''}
    ${seal(846, 1166, hex.name)}
  </g>`
}

/** 大象分成「象」與「君子以…」兩行 */
export function splitDaxiang(daxiang) {
  const cut = daxiang.indexOf('。')
  if (cut === -1 || cut === daxiang.length - 1) return [daxiang, '']
  return [daxiang.slice(0, cut + 1), daxiang.slice(cut + 1)]
}

const DEFS = `
<defs>
  <linearGradient id="gold" x1="0" y1="0" x2="0.35" y2="1">
    <stop offset="0" stop-color="#f4e3b2"/><stop offset=".35" stop-color="#c9a96b"/>
    <stop offset=".7" stop-color="#8d6c39"/><stop offset="1" stop-color="#dcc08a"/>
  </linearGradient>
  <linearGradient id="goldText" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fbf0cf"/><stop offset=".55" stop-color="#e2c78e"/><stop offset="1" stop-color="#a98545"/>
  </linearGradient>
  <linearGradient id="plaque" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#202733" stop-opacity=".95"/><stop offset="1" stop-color="#0f1115" stop-opacity=".97"/>
  </linearGradient>
  <linearGradient id="enamelShade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".28"/>
  </linearGradient>
  <filter id="lift" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity=".7"/>
  </filter>
  <filter id="rough" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</defs>`

export function cardFaceSvg(hex, classic) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${DEFS}
<path d="M0,0 H${W} V${H} H0 Z M48,18 H${W - 48} Q${W - 18},18 ${W - 18},48 V${H - 48} Q${W - 18},${H - 18} ${W - 48},${H - 18} H48 Q18,${H - 18} 18,${H - 48} V48 Q18,18 48,18 Z" fill="${INK}" fill-rule="evenodd"/>
<rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="30" fill="none" stroke="url(#gold)" stroke-width="5"/>
${enamelBand(hex.upper, hex.lower)}
<rect x="58" y="58" width="${W - 116}" height="${H - 116}" rx="8" fill="none" stroke="${GOLD}" stroke-width="1.5" opacity=".75"/>
${corner(38, 38, hex.upper.color)}${corner(W - 38, 38, hex.upper.color)}
${corner(38, H - 38, hex.lower.color)}${corner(W - 38, H - 38, hex.lower.color)}
${medallion(46, 380, hex.upper.color, hex.upper.name)}${medallion(W - 46, 380, hex.upper.color, hex.upper.image)}
${medallion(46, 860, hex.lower.color, hex.lower.name)}${medallion(W - 46, 860, hex.lower.color, hex.lower.image)}
${cartouche(hex.number)}
${titlePlaque(hex, classic)}
</svg>`
}
