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
  /** 為什麼這樣讀：只講規則本身的道理，不含吉凶（規格「朱熹讀法的說明」） */
  ruleExplanation: string
}

// 依變爻數排列，第七、八項是六爻全變的乾坤與其餘六十二卦。說明依《易學啟蒙・考變占》原文，
// 經 Codex 與 agy 檢視後定稿（docs/content-review.md「朱熹讀法的說明」）
const RULES: [rule: string, explanation: string][] = [
  ['六爻皆不變，占本卦卦辭。', '沒有任何一爻在動，卦象停在本卦，所以只讀本卦卦辭。'],
  ['一爻變，占本卦變爻的爻辭。', '只有一爻在動，變化就出在這一爻，所以讀本卦這一爻的爻辭。'],
  ['二爻變，占本卦兩個變爻的爻辭，以上面那一爻為主。', '朱熹把一卦的六十四種變化依序排成圖，變在前半的讀本卦的辭，變在後半的讀之卦的辭。兩爻動排在前半，所以讀本卦這兩個變爻的爻辭，上面那一爻為主；他註明這一條「經傳無文，今以例推之」。'],
  ['三爻變，占本卦與之卦的卦辭，以本卦為主（貞）、之卦為輔（悔）。', '三爻動時本卦與之卦的卦辭都要讀，朱熹稱本卦為「貞」、之卦為「悔」。他的圖裡三爻變共二十卦，正好跨在前後兩半之間，所以又分「前十卦主貞，後十卦主悔」；本站沒有細分，一律以本卦為主。'],
  ['四爻變，占之卦兩個不變爻的爻辭，以下面那一爻為主。', '四爻動已排到朱熹變卦圖的後半，改讀之卦的辭：取之卦裡陰陽沒有變的那兩個爻位，下面那一爻為主。朱熹註明這一條也是「以例推之」。'],
  ['五爻變，占之卦唯一不變爻的爻辭。', '五爻動同樣讀之卦：只剩一個爻位的陰陽沒有變，讀之卦這一爻的爻辭。'],
  ['六爻全變，乾坤兩卦占「用九」「用六」。', '乾是純陽、坤是純陰，經文另有「用九」「用六」專講六爻全動的情形，所以讀這一條，不讀之卦卦辭。'],
  ['六爻全變，占之卦卦辭。', '六爻全動，本卦整個變成之卦，所以讀之卦卦辭。'],
]

/** 變爻位置去重、由下而上排序；不是 0 到 5 的整數就丟出 RangeError（負數與小數不會被 changed() 擋下，卻會算進變爻數） */
export function movingPositions(moving: readonly number[]): number[] {
  for (const i of moving) {
    if (!Number.isInteger(i) || i < 0 || i > 5) throw new RangeError(`變爻位置必須是 0 到 5 的整數：${i}`)
  }
  return [...new Set(moving)].sort((a, b) => a - b)
}

export function interpret(primary: Hexagram, moving: readonly number[]): Reading {
  const sorted = movingPositions(moving)
  const result = changed(primary, sorted)
  const still = [0, 1, 2, 3, 4, 5].filter(i => !sorted.includes(i))
  const line = (hexagram: Hexagram, position: number): ReadingFocus => ({ kind: 'line', hexagram, position })
  const judgment = (hexagram: Hexagram): ReadingFocus => ({ kind: 'judgment', hexagram })
  const reading = (index: number, focus: ReadingFocus[], rule = RULES[index][0]): Reading =>
    ({ primary, result, moving: sorted, focus, rule, ruleExplanation: RULES[index][1] })
  switch (sorted.length) {
    case 0: return reading(0, [judgment(primary)])
    case 1: return reading(1, [line(primary, sorted[0])])
    case 2: return reading(2, [line(primary, sorted[1]), line(primary, sorted[0])])
    case 3: return reading(3, [judgment(primary), judgment(result)])
    case 4: return reading(4, [line(result, still[0]), line(result, still[1])])
    case 5: return reading(5, [line(result, still[0])])
    default:
      // 乾坤六爻全變讀用九、用六，其餘讀之卦卦辭
      if (primary.number <= 2) return reading(6, [{ kind: 'useAll', hexagram: primary }], `六爻全變，乾坤兩卦占「${primary.number === 1 ? '用九' : '用六'}」。`)
      return reading(7, [judgment(result)])
  }
}
