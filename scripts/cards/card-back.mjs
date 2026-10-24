// 牌背：太極居中，外圍先天八卦，再外一圈六十四格。
// 牌背要讓人分不出牌是正放還是倒放，所以整體保持 180° 旋轉對稱：
// 先天八卦相對的兩卦正好互錯，轉半圈後形狀相同、只是陰陽互換。
import { trigrams } from '../../src/data/trigrams.ts'
import { H, W } from './card-face.mjs'

const GOLD = '#c9a96b'
const INK = '#111318'
const CX = W / 2, CY = H / 2

// 先天八卦方位：南（上）乾，順時針巽、坎、艮、坤、震、離、兌
const FUXI_RING = ['qian', 'xun', 'kan', 'gen', 'kun', 'zhen', 'li', 'dui']

function trigramGlyph(lines, angle, radius) {
  // 初爻朝向圓心
  const bars = lines.map((bit, i) => {
    const y = -(i * 22)
    return bit
      ? `<rect x="-46" y="${y - 7}" width="92" height="14" rx="1.5"/>`
      : `<rect x="-46" y="${y - 7}" width="38" height="14" rx="1.5"/><rect x="8" y="${y - 7}" width="38" height="14" rx="1.5"/>`
  }).join('')
  return `<g transform="translate(${CX} ${CY}) rotate(${angle}) translate(0 ${-radius})" fill="url(#gold)">${bars}</g>`
}

function taiji(r) {
  const h = r / 2
  return `<g transform="translate(${CX} ${CY}) rotate(-90)">
    <circle r="${r + 10}" fill="none" stroke="url(#gold)" stroke-width="3"/>
    <circle r="${r}" fill="${INK}"/>
    <path d="M0,${-r} A${r},${r} 0 0 1 0,${r} A${h},${h} 0 0 1 0,0 A${h},${h} 0 0 0 0,${-r} Z" fill="url(#gold)"/>
    <circle cx="0" cy="${-h}" r="${r * 0.13}" fill="url(#gold)"/>
    <circle cx="0" cy="${h}" r="${r * 0.13}" fill="${INK}"/>
    <circle r="${r}" fill="none" stroke="#5b4626" stroke-width="2"/>
  </g>`
}

function lattice() {
  // 分離派的金色方格帶，上下各一條，彼此 180° 對稱
  const cells = []
  for (let i = 0; i < 17; i++) {
    const x = 117 + i * 45
    cells.push(`<rect x="${x}" y="96" width="22" height="22" fill="${i % 2 ? '#8a6a3a' : '#2a3442'}" stroke="url(#gold)" stroke-width="1.5"/>`)
    cells.push(`<rect x="${W - x - 22}" y="${H - 118}" width="22" height="22" fill="${i % 2 ? '#8a6a3a' : '#2a3442'}" stroke="url(#gold)" stroke-width="1.5"/>`)
  }
  return cells.join('')
}

export function cardBackSvg() {
  const ticks = Array.from({ length: 64 }, (_, i) => {
    const long = i % 8 === 0
    return `<line x1="0" y1="${-388}" x2="0" y2="${long ? -414 : -400}" stroke="url(#gold)" stroke-width="${long ? 3 : 2}" transform="translate(${CX} ${CY}) rotate(${i * 5.625})"/>`
  }).join('')
  const byId = Object.fromEntries(trigrams.map(t => [t.id, t]))
  const ring = FUXI_RING.map((id, k) => trigramGlyph(byId[id].lines, k * 45, 250)).join('')
  const seal = (x, y, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})" filter="url(#rough)">
    <rect x="-30" y="-30" width="60" height="60" rx="4" fill="#a3402c"/>
    <text x="0" y="14" font-family="'Noto Serif TC'" font-size="38" fill="#f6eee0" stroke="#f6eee0" stroke-width="1.2" text-anchor="middle">易</text></g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="gold" x1="0" y1="0" x2="0.35" y2="1">
    <stop offset="0" stop-color="#f4e3b2"/><stop offset=".35" stop-color="#c9a96b"/>
    <stop offset=".7" stop-color="#8d6c39"/><stop offset="1" stop-color="#dcc08a"/>
  </linearGradient>
  <radialGradient id="field" cx=".5" cy=".5" r=".7">
    <stop offset="0" stop-color="#253043"/><stop offset=".6" stop-color="#161a22"/><stop offset="1" stop-color="#0d0f13"/>
  </radialGradient>
  <filter id="wash"><feTurbulence type="fractalNoise" baseFrequency=".006" numOctaves="4" seed="5"/>
    <feColorMatrix values="0 0 0 0 .8  0 0 0 0 .78  0 0 0 0 .7  0 0 0 .16 0"/></filter>
  <filter id="rough" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</defs>
<rect width="${W}" height="${H}" rx="30" fill="url(#field)"/>
<rect width="${W}" height="${H}" filter="url(#wash)"/>
<rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="28" fill="none" stroke="url(#gold)" stroke-width="8"/>
<rect x="44" y="44" width="${W - 88}" height="${H - 88}" rx="14" fill="none" stroke="url(#gold)" stroke-width="2.5"/>
<rect x="58" y="58" width="${W - 116}" height="${H - 116}" rx="8" fill="none" stroke="${GOLD}" stroke-width="1" opacity=".6"/>
${lattice()}
<circle cx="${CX}" cy="${CY}" r="430" fill="none" stroke="${GOLD}" stroke-width="1" opacity=".5"/>
<circle cx="${CX}" cy="${CY}" r="388" fill="none" stroke="url(#gold)" stroke-width="2"/>
${ticks}
<circle cx="${CX}" cy="${CY}" r="322" fill="none" stroke="${GOLD}" stroke-width="1" opacity=".55"/>
${ring}
<circle cx="${CX}" cy="${CY}" r="180" fill="none" stroke="${GOLD}" stroke-width="1" opacity=".55"/>
${taiji(130)}
${seal(110, 190, 0)}${seal(W - 110, H - 190, 180)}
</svg>`
}
