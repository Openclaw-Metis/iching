// 考核成績：每次送出都留一筆，通過與否由分數決定。

import { requireDb } from '../connection.ts'
import type { ExamResult } from '../db.ts'

export async function recordExam(result: Omit<ExamResult, 'id' | 'at'>, now = new Date()): Promise<ExamResult> {
  const db = await requireDb()
  const row: ExamResult = { ...result, id: crypto.randomUUID(), at: now.toISOString() }
  await db.examResults.add(row)
  return row
}

export async function all(): Promise<ExamResult[]> {
  const db = await requireDb()
  return db.examResults.toArray()
}
