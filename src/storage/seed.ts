// 開發用示範資料：只在開發模式且網址帶 ?seed=demo 時寫入。main.tsx 以 import.meta.env.DEV 包住動態載入，
// 正式建置會把這段整個移除。主鍵固定為 demo-*，重跑只會覆寫同一批資料。

import { changed, hexagramOf } from '../data/hexagrams.ts'
import type { Bit } from '../data/trigrams.ts'
import { addDays, localDateKey } from '../lib/dates.ts'
import { randomInt } from '../lib/rng.ts'
import { requireDb } from './connection.ts'
import type { Category, DailyDraw, ExamResult, LessonProgress, LineValue, Method, Reading, XpEvent } from './db.ts'

const QUESTIONS = [
  '要不要接下新的專案？', '這次搬家的時機合適嗎？', '和老同學合夥開店好不好？', '該不該換到新部門？', '要不要報名研究所？',
  '這段感情該怎麼走下去？', '和家人的爭執要怎麼處理？', '下半年要不要出國進修？', '這筆投資要不要先觀望？', '要不要開始學一樣新樂器？',
]
const CATEGORIES: Category[] = ['career', 'relations', 'decision', 'general']
const METHODS: Method[] = ['coins', 'yarrow-quick', 'manual', 'yarrow-hand']

function readingFrom(lines: LineValue[]) {
  const bits = lines.map(v => (v % 2 === 1 ? 1 : 0)) as Bit[]
  const moving = lines.flatMap((v, i) => (v === 6 || v === 9 ? [i] : []))
  const primary = hexagramOf(bits)
  return { primary: primary.number, result: changed(primary, moving).number, moving }
}

const coinLine = (): LineValue => ((randomInt(2, 3) + randomInt(2, 3) + randomInt(2, 3)) as LineValue)

export async function seedIfRequested(search = globalThis.location?.search ?? '') {
  if (!import.meta.env.DEV) return
  if (new URLSearchParams(search).get('seed') !== 'demo') return
  const db = await requireDb()
  const now = new Date()
  const iso = (daysAgo: number, hour = 9) => {
    const d = new Date(now)
    d.setDate(d.getDate() - daysAgo)
    d.setHours(hour, 0, 0, 0)
    return d.toISOString()
  }
  const today = localDateKey(now)

  const readings: Reading[] = QUESTIONS.map((question, i) => {
    const lines = Array.from({ length: 6 }, coinLine)
    const at = iso(i * 3)
    return {
      id: `demo-${i + 1}`, createdAt: at, updatedAt: at, rev: 1, question,
      category: CATEGORIES[i % 4], method: METHODS[i % 4], lines, ...readingFrom(lines),
      note: i % 2 ? '' : '先記下當下的直覺：想再多問幾個人的意見。',
      followUp: i >= 6 ? { text: '事後看來，當時的猶豫是有道理的。', writtenAt: iso(i) } : null,
      starred: i % 3 === 0 ? 1 : 0, v: 1, deletedAt: null,
    }
  })

  const dailyDraws: DailyDraw[] = Array.from({ length: 7 }, (_, i) => ({
    date: addDays(today, -i), hexagram: randomInt(1, 64), drawnAt: iso(i, 8), note: i === 1 ? '今天提醒自己慢一點。' : '', updatedAt: iso(i, 8), rev: 1,
  }))

  const lessons: LessonProgress[] = [1, 2, 3].map(l => ({
    lessonId: `S1-L${l}`, stationId: 1, status: 'completed', step: 0, correct: 5, total: 5, completedAt: iso(10 - l), updatedAt: iso(10 - l),
  }))
  lessons.push({ lessonId: 'S2-L1', stationId: 2, status: 'available', step: 0, correct: 0, total: 0, completedAt: null, updatedAt: iso(6) })
  const exam: ExamResult = { id: 'demo-exam-1', attemptId: 'demo-attempt-1', stationId: 1, score: 9, passed: true, at: iso(6) }
  const xp: XpEvent[] = [
    ...[1, 2, 3].map(l => ({ id: `demo-xp-lesson-${l}`, key: `lesson:S1-L${l}`, at: iso(10 - l), date: localDateKey(new Date(iso(10 - l))), amount: 10, source: 'lesson' as const, ref: `S1-L${l}` })),
    { id: 'demo-xp-exam-1', key: 'exam:1', at: iso(6), date: localDateKey(new Date(iso(6))), amount: 30, source: 'exam', ref: '1' },
  ]

  await db.transaction('rw', [db.readings, db.dailyDraws, db.lessonProgress, db.examResults, db.xpEvents], async () => {
    await db.readings.bulkPut(readings)
    await db.dailyDraws.bulkPut(dailyDraws)
    await db.lessonProgress.bulkPut(lessons)
    await db.examResults.put(exam)
    await db.xpEvents.bulkPut(xp)
  })
  console.info('已寫入示範資料：10 筆占卜紀錄、7 天今日卦、第一站學堂進度')
}
