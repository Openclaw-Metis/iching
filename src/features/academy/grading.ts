// 解鎖與評分（規格「學堂內容設計」與 Stage 6）：第一站第一課預設可學；完成前一課開放下一課；
// 一站三課都完成開放考核；考核答對 8 題以上通過，並開放下一站第一課。
// 狀態一律由課程進度與考核成績推算，不另存解鎖旗標。

import { lessonId, parseLessonId, STATIONS } from '../../data/stations.ts'
import type { AnswerRecord, ExamResult, LessonProgress, QuestionSnapshot } from '../../storage/index.ts'
import { PASS_SCORE } from './curriculum.ts'

export type LessonStatus = 'locked' | 'available' | 'in-progress' | 'completed'
export type ExamStatus = 'locked' | 'available' | 'passed'

export const LESSON_LABEL: Record<LessonStatus, string> = { locked: '未開放', available: '可學', 'in-progress': '學習中', completed: '完成' }

export const passedStations = (exams: Pick<ExamResult, 'stationId' | 'passed'>[]) => new Set(exams.filter(e => e.passed).map(e => e.stationId))

export function highestPassed(exams: Pick<ExamResult, 'stationId' | 'passed'>[]): number {
  return Math.max(0, ...passedStations(exams))
}

export function lessonStatus(id: string, progress: LessonProgress[], exams: ExamResult[]): LessonStatus {
  const row = progress.find(p => p.lessonId === id)
  if (row) return row.status
  const parsed = parseLessonId(id)
  if (!parsed) return 'locked'
  const { station, index } = parsed
  if (index === 1) return station.id === 1 || passedStations(exams).has(station.id - 1) ? 'available' : 'locked'
  const prev = progress.find(p => p.lessonId === lessonId(station.id, index - 1))
  return prev?.status === 'completed' ? 'available' : 'locked'
}

export function examStatus(stationId: number, progress: LessonProgress[], exams: ExamResult[]): ExamStatus {
  if (passedStations(exams).has(stationId)) return 'passed'
  const done = [1, 2, 3].every(i => progress.find(p => p.lessonId === lessonId(stationId, i))?.status === 'completed')
  return done ? 'available' : 'locked'
}

export type NextStep = { kind: 'lesson'; id: string } | { kind: 'exam'; stationId: number } | null

/** 「繼續下一課」：依路線順序找第一個還沒完成的課或還沒通過的考核 */
export function nextStep(progress: LessonProgress[], exams: ExamResult[]): NextStep {
  for (const s of STATIONS) {
    for (let i = 1; i <= 3; i++) {
      const id = lessonId(s.id, i)
      const status = lessonStatus(id, progress, exams)
      if (status === 'available' || status === 'in-progress') return { kind: 'lesson', id }
    }
    if (examStatus(s.id, progress, exams) === 'available') return { kind: 'exam', stationId: s.id }
  }
  return null
}

export const isCorrect = (q: QuestionSnapshot, a: AnswerRecord | null) => a !== null && a.choice === q.answerIndex

export function scoreExam(questions: QuestionSnapshot[], answers: (AnswerRecord | null)[]): number {
  return questions.reduce((n, q, i) => n + (isCorrect(q, answers[i]) ? 1 : 0), 0)
}

export const isPassing = (score: number) => score >= PASS_SCORE
