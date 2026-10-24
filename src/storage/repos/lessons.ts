// 學堂的課程進度。解鎖狀態不另存，由課程進度與考核成績推算（features/academy/grading.ts），
// 合併另一台裝置的備份後也會自動一致。

import { requireDb } from '../connection.ts'
import type { ExamResult, IchingDB, LessonProgress, Mastery } from '../db.ts'

/** 進入一課或每前進一步時記下步驟與答對數；已完成的課重做不改回去 */
export async function touchLesson(lessonId: string, stationId: number, step: number, correct: number, total: number, now = new Date()): Promise<void> {
  const db = await requireDb()
  await db.transaction('rw', db.lessonProgress, async () => {
    const current = await db.lessonProgress.get(lessonId)
    const at = now.toISOString()
    if (current?.status === 'completed') return
    await db.lessonProgress.put({
      lessonId, stationId, status: 'in-progress', step, correct, total, completedAt: null, updatedAt: at,
    })
  })
}

/** 完成一課；重做時保留第一次完成的時間 */
export async function completeLesson(lessonId: string, stationId: number, correct: number, total: number, now = new Date()): Promise<LessonProgress> {
  const db = await requireDb()
  return db.transaction('rw', db.lessonProgress, async () => {
    const current = await db.lessonProgress.get(lessonId)
    const at = now.toISOString()
    const row: LessonProgress = {
      lessonId, stationId, status: 'completed', step: total, correct, total,
      completedAt: current?.completedAt ?? at, updatedAt: at,
    }
    await db.lessonProgress.put(row)
    return row
  })
}

export interface AcademyState {
  progress: LessonProgress[]
  exams: ExamResult[]
  mastery: Mastery[]
}

/** 給 useLiveQuery 直接用 */
export async function stateOf(db: IchingDB): Promise<AcademyState> {
  const [progress, exams, mastery] = await Promise.all([db.lessonProgress.toArray(), db.examResults.toArray(), db.mastery.toArray()])
  return { progress, exams, mastery }
}
