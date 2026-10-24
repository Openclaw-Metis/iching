// 依變爻數決定該讀哪段經文，採朱熹《易學啟蒙・考變占》的通行規則。
// 三爻變時朱熹另有「前十卦主貞，後十卦主悔」的細分，這裡只取本卦為主、之卦為輔的大原則。

import { changed, type Hexagram } from '../data/hexagrams.ts'

export type ReadingFocus =
  | { kind: 'judgment'; hexagram: Hexagram }
  | { kind: 'line'; hexagram: Hexagram; position: number }
  | { kind: 'useAll'; hexagram: Hexagram }

export interface Reading {
  primary: Hexagram
  result: Hexagram
  moving: number[]
  /** 依序列出要讀的經文，第一項為主 */
  focus: ReadingFocus[]
  rule: string
}

export function interpret(primary: Hexagram, moving: number[]): Reading {
  const sorted = [...new Set(moving)].sort((a, b) => a - b)
  const result = changed(primary, sorted)
  const still = [0, 1, 2, 3, 4, 5].filter(i => !sorted.includes(i))
  const line = (hexagram: Hexagram, position: number): ReadingFocus => ({ kind: 'line', hexagram, position })
  switch (sorted.length) {
    case 0:
      return { primary, result, moving: sorted, rule: '六爻皆不變，占本卦卦辭。', focus: [{ kind: 'judgment', hexagram: primary }] }
    case 1:
      return { primary, result, moving: sorted, rule: '一爻變，占本卦變爻的爻辭。', focus: [line(primary, sorted[0])] }
    case 2:
      return { primary, result, moving: sorted, rule: '二爻變，占本卦兩個變爻的爻辭，以上面那一爻為主。', focus: [line(primary, sorted[1]), line(primary, sorted[0])] }
    case 3:
      return { primary, result, moving: sorted, rule: '三爻變，占本卦與之卦的卦辭，以本卦為主（貞）、之卦為輔（悔）。', focus: [{ kind: 'judgment', hexagram: primary }, { kind: 'judgment', hexagram: result }] }
    case 4:
      return { primary, result, moving: sorted, rule: '四爻變，占之卦兩個不變爻的爻辭，以下面那一爻為主。', focus: [line(result, still[0]), line(result, still[1])] }
    case 5:
      return { primary, result, moving: sorted, rule: '五爻變，占之卦唯一不變爻的爻辭。', focus: [line(result, still[0])] }
    default:
      // 乾坤六爻全變讀用九、用六，其餘讀之卦卦辭
      if (primary.number <= 2) return { primary, result, moving: sorted, rule: `六爻全變，乾坤兩卦占「${primary.number === 1 ? '用九' : '用六'}」。`, focus: [{ kind: 'useAll', hexagram: primary }] }
      return { primary, result, moving: sorted, rule: '六爻全變，占之卦卦辭。', focus: [{ kind: 'judgment', hexagram: result }] }
  }
}
