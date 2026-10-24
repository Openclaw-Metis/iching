// 看圖猜卦練習（規格「看圖猜卦練習」）：每次 10 題，優先抽還沒答對過看圖題的卦。
// 進度只在當次有效，不寫入作答進度；答對照樣給作答 XP（計入每日上限）並寫入掌握紀錄。

import { cryptoSource, randomInt, type Uint32Source } from '../../lib/rng.ts'
import { mastery, xp } from '../../storage/index.ts'
import { generateQuestion } from './questions/generate.ts'
import type { Question } from './questions/types.ts'

export const PRACTICE_SIZE = 10

function shuffle<T>(list: T[], src: Uint32Source): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(0, i, src)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** masteredImage：已經答對過看圖題的卦序 */
export function practiceQuestions(masteredImage: ReadonlySet<number>, src: Uint32Source = cryptoSource): Question[] {
  const all = Array.from({ length: 64 }, (_, i) => i + 1)
  const fresh = shuffle(all.filter(n => !masteredImage.has(n)), src)
  const seen = shuffle(all.filter(n => masteredImage.has(n)), src)
  return [...fresh, ...seen].slice(0, PRACTICE_SIZE).map(n => generateQuestion('image-to-name', { hexagrams: [n] }, src))
}

export interface PracticeResult {
  correct: boolean
  xp: number
  capped: boolean
}

export async function answerPractice(sessionId: string, index: number, q: Question, choice: number, now = new Date()): Promise<PracticeResult> {
  const correct = choice === q.answerIndex
  if (!correct) return { correct, xp: 0, capped: false }
  const r = await xp.award({ key: `answer:${sessionId}:${index}`, source: 'answer', amount: xp.XP_AMOUNTS.answer, ref: q.questionKey }, now)
  if (q.hexagram && q.facet) await mastery.markMastery(q.hexagram, q.facet, now)
  return { correct, xp: r.awarded, capped: r.capped }
}
