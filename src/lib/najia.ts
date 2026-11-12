// 京房納甲六爻排盤（規格「納甲六爻盤」）：納干支、六親、伏神，給了月建與日辰時再標六神、旬空、月破、日沖。
// 只排盤，不取用神、不判旺衰。八宮與世應沿用 hexagrams.ts 的 palace，不重算。爻位一律 0 到 5（初爻為 0）。

import { changed, hexagramOf, type Hexagram } from '../data/hexagrams.ts'
import type { Bit, Trigram, TrigramId } from '../data/trigrams.ts'
import { BRANCHES, STEMS, branchElement, clashOf, voidBranches, type Element } from './ganzhi.ts'
import { movingPositions } from './reading.ts'

export type Relation = '兄弟' | '子孫' | '妻財' | '官鬼' | '父母'
export type Spirit = '青龍' | '朱雀' | '勾陳' | '螣蛇' | '白虎' | '玄武'

// 八卦納甲：內卦與外卦的天干，以及初爻到上爻的六個地支（作內卦取前三個、作外卦取後三個）。
// 陽卦（乾震坎艮）地支順行、陰卦（坤巽離兌）逆行，各隔一位。
const NAJIA: Record<TrigramId, [stems: string, branches: string]> = {
  qian: ['甲壬', '子寅辰午申戌'],
  kun: ['乙癸', '未巳卯丑亥酉'],
  zhen: ['庚庚', '子寅辰午申戌'],
  xun: ['辛辛', '丑亥酉未巳卯'],
  kan: ['戊戊', '寅辰午申戌子'],
  li: ['己己', '卯丑亥酉未巳'],
  gen: ['丙丙', '辰午申戌子寅'],
  dui: ['丁丁', '巳卯丑亥酉未'],
}

// 相生的順序；六親由「爻的五行」比「宮的五行」往後數幾位決定：同我兄弟、我生子孫、我剋妻財、剋我官鬼、生我父母
const CYCLE: Element[] = ['木', '火', '土', '金', '水']
const RELATIONS: Relation[] = ['兄弟', '子孫', '妻財', '官鬼', '父母']
const SPIRITS: Spirit[] = ['青龍', '朱雀', '勾陳', '螣蛇', '白虎', '玄武']
// 日干起六神：甲乙青龍、丙丁朱雀、戊勾陳、己螣蛇、庚辛白虎、壬癸玄武
const SPIRIT_START = [0, 0, 1, 1, 2, 3, 4, 4, 5, 5]

/** 一爻所納的干支，連同五行、六親與日月的標記 */
export interface NajiaYao {
  /** 天干序號（甲為 0） */
  stem: number
  /** 地支序號（子為 0） */
  branch: number
  element: Element
  relation: Relation
  /** 以下三項只在給了月建與日辰時出現 */
  void?: boolean
  monthBreak?: boolean
  dayClash?: boolean
}

export interface NajiaLine extends NajiaYao {
  position: number
  bit: Bit
  shi: boolean
  ying: boolean
  moving: boolean
  /** 變爻變出來的爻（之卦同一爻位），六親仍依本卦的宮 */
  changed?: NajiaYao
  /** 伏在這一爻之下的伏神（這一爻是飛神） */
  hidden?: NajiaYao
  spirit?: Spirit
}

export interface NajiaTime {
  /** 月建地支序號 */
  month: number
  /** 日辰的六十甲子序 */
  day: number
}

export interface NajiaChart {
  primary: Hexagram
  result: Hexagram
  /** 本卦所屬的宮，六親依它的五行 */
  palace: Trigram
  /** 初爻在前 */
  lines: NajiaLine[]
  /** 本卦六爻沒有、改由伏神補上的六親 */
  missing: Relation[]
  /** 旬空的兩個地支；沒有給日辰時不出現 */
  voidBranches?: [number, number]
}

export function relationOf(palace: Element, yao: Element): Relation {
  return RELATIONS[(CYCLE.indexOf(yao) - CYCLE.indexOf(palace) + 5) % 5]
}

function yaoOf(hexagram: Hexagram, position: number, palace: Element): NajiaYao {
  const outer = position >= 3
  const [stems, branches] = NAJIA[(outer ? hexagram.upper : hexagram.lower).id]
  const branch = BRANCHES.indexOf(branches[position])
  const element = branchElement(branch)
  return { stem: STEMS.indexOf(stems[outer ? 1 : 0]), branch, element, relation: relationOf(palace, element) }
}

export function najia(primary: Hexagram, moving: readonly number[] = [], time?: NajiaTime): NajiaChart {
  const sorted = movingPositions(moving)
  // 月建與日辰可能來自畫面選單或日後保存的資料；錯的序號會排出看似正常的盤，所以在入口擋下
  if (time && !(Number.isInteger(time.month) && time.month >= 0 && time.month < 12 && Number.isInteger(time.day) && time.day >= 0 && time.day < 60)) {
    throw new RangeError(`月建或日辰不合法：${time.month}、${time.day}`)
  }
  const result = changed(primary, sorted)
  const palace = primary.palace.trigram
  const pure = hexagramOf([...palace.lines, ...palace.lines])
  const empty = time && voidBranches(time.day)

  const mark = (yao: NajiaYao): NajiaYao => time && empty
    ? { ...yao, void: empty.includes(yao.branch), monthBreak: yao.branch === clashOf(time.month), dayClash: yao.branch === clashOf(time.day % 12) }
    : yao

  const lines: NajiaLine[] = primary.lines.map((bit, position) => ({
    ...mark(yaoOf(primary, position, palace.element)),
    position,
    bit,
    shi: primary.palace.shi === position + 1,
    ying: primary.palace.ying === position + 1,
    moving: sorted.includes(position),
    ...(sorted.includes(position) ? { changed: mark(yaoOf(result, position, palace.element)) } : {}),
    ...(time ? { spirit: SPIRITS[(SPIRIT_START[time.day % 10] + position) % 6] } : {}),
  }))

  const missing = RELATIONS.filter(r => !lines.some(l => l.relation === r))
  for (let position = 0; position < 6; position++) {
    const yao = yaoOf(pure, position, palace.element)
    if (missing.includes(yao.relation)) lines[position].hidden = mark(yao)
  }
  return { primary, result, palace, lines, missing, ...(empty ? { voidBranches: empty } : {}) }
}

export const yaoGanzhi = (yao: NajiaYao) => `${STEMS[yao.stem]}${BRANCHES[yao.branch]}`
