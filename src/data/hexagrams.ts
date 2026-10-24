// 六十四卦的結構資料：全部由六爻推算，避免手抄出錯。
// 爻序一律由下而上（index 0 為初爻）。

import { trigrams, trigramOf, type Bit, type Trigram } from './trigrams.ts'

export type Lines = [Bit, Bit, Bit, Bit, Bit, Bit]

export interface Hexagram {
  /** 文王卦序 1–64 */
  number: number
  name: string
  /** 卦名全稱，如「水雷屯」「乾為天」 */
  fullName: string
  lines: Lines
  upper: Trigram
  lower: Trigram
  /** 伏羲先天六十四卦次序 1–64（邵雍，下卦為主序） */
  fuxi: number
  palace: { trigram: Trigram; generation: PalaceGeneration; shi: number; ying: number }
  /** 十二消息卦的夏曆月份 */
  month?: number
}

export type PalaceGeneration = '本宮' | '一世' | '二世' | '三世' | '四世' | '五世' | '遊魂' | '歸魂'

const NAMES = [
  '乾', '坤', '屯', '蒙', '需', '訟', '師', '比', '小畜', '履', '泰', '否', '同人', '大有', '謙', '豫',
  '隨', '蠱', '臨', '觀', '噬嗑', '賁', '剝', '復', '无妄', '大畜', '頤', '大過', '坎', '離', '咸', '恒',
  '遯', '大壯', '晉', '明夷', '家人', '睽', '蹇', '解', '損', '益', '夬', '姤', '萃', '升', '困', '井',
  '革', '鼎', '震', '艮', '漸', '歸妹', '豐', '旅', '巽', '兌', '渙', '節', '中孚', '小過', '既濟', '未濟',
]

// 文王卦序矩陣：列為上卦、行為下卦，皆依先天序（乾兌離震巽坎艮坤）
const KING_WEN = [
  [1, 10, 13, 25, 44, 6, 33, 12],
  [43, 58, 49, 17, 28, 47, 31, 45],
  [14, 38, 30, 21, 50, 64, 56, 35],
  [34, 54, 55, 51, 32, 40, 62, 16],
  [9, 61, 37, 42, 57, 59, 53, 20],
  [5, 60, 63, 3, 48, 29, 39, 8],
  [26, 41, 22, 27, 18, 4, 52, 23],
  [11, 19, 36, 24, 46, 7, 15, 2],
]

// 十二消息卦：復為十一月（子），依次到坤為十月（亥）
const MONTHS: Record<number, number> = { 24: 11, 19: 12, 11: 1, 34: 2, 43: 3, 1: 4, 44: 5, 33: 6, 12: 7, 20: 8, 23: 9, 2: 10 }

const GENERATIONS: PalaceGeneration[] = ['本宮', '一世', '二世', '三世', '四世', '五世', '遊魂', '歸魂']
// 世爻位置（1 為初爻）；應爻與世爻相隔三位
const SHI = [6, 1, 2, 3, 4, 5, 4, 3]

export const key = (lines: readonly Bit[]) => lines.join('')

function flip(lines: Lines, indexes: number[]): Lines {
  const next = [...lines] as Lines
  for (const i of indexes) next[i] = (1 - next[i]) as Bit
  return next
}

// 京房八宮：本宮之後由初爻起逐爻變到五爻，再變回四爻為遊魂，下卦復原為歸魂
function palaceTable() {
  const table = new Map<string, { trigram: Trigram; generation: PalaceGeneration; shi: number; ying: number }>()
  for (const t of trigrams) {
    const base = [...t.lines, ...t.lines] as Lines
    const seq: Lines[] = [base]
    for (let g = 1; g <= 5; g++) seq.push(flip(base, Array.from({ length: g }, (_, i) => i)))
    const youhun = flip(seq[5], [3])
    seq.push(youhun, flip(youhun, [0, 1, 2]))
    seq.forEach((lines, g) => {
      const shi = SHI[g]
      table.set(key(lines), { trigram: t, generation: GENERATIONS[g], shi, ying: ((shi + 2) % 6) + 1 })
    })
  }
  return table
}

function build(): Hexagram[] {
  const palaces = palaceTable()
  const list: Hexagram[] = []
  for (const upper of trigrams) {
    for (const lower of trigrams) {
      const number = KING_WEN[upper.fuxi - 1][lower.fuxi - 1]
      const lines = [...lower.lines, ...upper.lines] as Lines
      const name = NAMES[number - 1]
      list.push({
        number,
        name,
        fullName: upper === lower ? `${name}為${upper.image}` : `${upper.image}${lower.image}${name}`,
        lines,
        upper,
        lower,
        fuxi: (lower.fuxi - 1) * 8 + upper.fuxi,
        palace: palaces.get(key(lines))!,
        month: MONTHS[number],
      })
    }
  }
  return list.sort((a, b) => a.number - b.number)
}

export const hexagrams: Hexagram[] = build()

const byKey = new Map(hexagrams.map(h => [key(h.lines), h]))

export function hexagramOf(lines: readonly Bit[]): Hexagram {
  const found = byKey.get(key(lines))
  if (!found) throw new Error(`不是六爻：${lines.join('')}`)
  return found
}

export const hexagram = (number: number) => {
  const found = hexagrams[number - 1]
  if (!found) throw new Error(`沒有第 ${number} 卦`)
  return found
}

/** 錯卦：六爻陰陽全變 */
export const cuo = (h: Hexagram) => hexagramOf(h.lines.map(b => 1 - b) as Bit[])
/** 綜卦：整卦上下顛倒 */
export const zong = (h: Hexagram) => hexagramOf([...h.lines].reverse())
/** 互卦：二至四爻為下卦、三至五爻為上卦 */
export const hu = (h: Hexagram) => hexagramOf([...h.lines.slice(1, 4), ...h.lines.slice(2, 5)])
/** 之卦：指定的爻（0 起算）陰陽互變 */
export const changed = (h: Hexagram, moving: number[]) => hexagramOf(flip(h.lines, moving))

/** 爻題：初九、六二……上六 */
export function lineLabel(position: number, bit: Bit): string {
  const yinyang = bit ? '九' : '六'
  if (position === 0) return `初${yinyang}`
  if (position === 5) return `上${yinyang}`
  return `${yinyang}${'二三四五'[position - 1]}`
}

export { trigramOf }
