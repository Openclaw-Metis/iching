// 學堂的作答流程（規格 API 的 academy.startAttempt、answer、completeLesson、submitExam）。
// 課程每題按「檢查」即揭露對錯；考核只保存選擇，送出後才一起評分。XP 一律經 xp.award，
// 業務鍵為 answer:<attemptId>:<題號>、lesson:<課號>、exam:<站號>，作答事件的 ref 是 questionKey（10 秒防刷用）。
// 卦畫認卦與看圖認卦答對時寫入掌握紀錄並建立溫故卡；完成課程、送出考核後判定印章。

import { localDateKey } from '../../lib/dates.ts'
import { attempts, exams, lessons, mastery, xp, type Attempt, type QuestionSnapshot, type SealId } from '../../storage/index.ts'
import { addFromAnswer } from '../review/index.ts'
import { EXAM_PLAN, lessonById } from './curriculum.ts'
import { highestPassed, isCorrect, isPassing, scoreExam } from './grading.ts'
import { generateSet } from './questions/generate.ts'
import { rankOf } from './ranks.ts'
import { checkSeals } from './seals.ts'

export function lessonQuestions(id: string): QuestionSnapshot[] {
  const lesson = lessonById(id)
  if (!lesson) throw new RangeError(`沒有這一課：${id}`)
  return lesson.steps.flatMap(s => (s.kind === 'quiz' ? generateSet(s.type, s.count, s.params) : []))
}

export function examQuestions(stationId: number): QuestionSnapshot[] {
  const plan = EXAM_PLAN[stationId]
  if (!plan) throw new RangeError(`沒有第 ${stationId} 站`)
  return plan.flatMap(p => generateSet(p.type, p.count, p.params))
}

export function startAttempt(kind: Attempt['kind'], target: string, now = new Date()): Promise<Attempt> {
  return attempts.startOrResume({
    kind, target, date: localDateKey(now), now,
    build: () => (kind === 'lesson' ? lessonQuestions(target) : examQuestions(Number(target))),
  })
}

export interface Reward extends xp.AwardResult {
  /** 這題讓一張溫故卡加入 */
  reviewAdded: boolean
}

/** 答對時給作答 XP；卦畫或看圖題另寫入掌握紀錄，溫故卡不存在（也沒被移出過）時建立並排程 */
export async function rewardCorrect(key: string, q: QuestionSnapshot, elapsedMs: number, now: Date): Promise<Reward> {
  const result = await xp.award({ key, source: 'answer', amount: xp.XP_AMOUNTS.answer, ref: q.questionKey }, now)
  let reviewAdded = false
  if (q.facet && q.hexagram) {
    await mastery.markMastery(q.hexagram, q.facet, now)
    reviewAdded = await addFromAnswer(q.hexagram, q.facet, elapsedMs, now)
  }
  return { ...result, reviewAdded }
}

/** 課程與考核：選了還沒前進也先存起來，回來時看到同樣的選擇 */
export function select(attemptId: string, index: number, choice: number, now = new Date()): Promise<Attempt> {
  return attempts.saveAnswer(attemptId, index, { choice, checked: false, correct: false, elapsedMs: 0 }, now)
}

export interface CheckResult {
  correct: boolean
  xp: number
  /** 今天的作答 XP 已滿 */
  capped: boolean
  reviewAdded: boolean
  attempt: Attempt
}

/** 課程按「檢查」；考核只保存選擇，回傳值不含對錯 */
export async function answer(attemptId: string, index: number, choice: number, elapsedMs: number, now = new Date()): Promise<CheckResult | { attempt: Attempt }> {
  const current = await attempts.get(attemptId)
  if (!current) throw new RangeError('找不到這次作答')
  if (current.kind === 'exam') {
    return { attempt: await attempts.saveAnswer(attemptId, index, { choice, checked: false, correct: false, elapsedMs }, now) }
  }
  const q = current.questions[index]
  const correct = choice === q.answerIndex
  const attempt = await attempts.saveAnswer(attemptId, index, { choice, checked: true, correct, elapsedMs }, now)
  if (!correct) return { correct, xp: 0, capped: false, reviewAdded: false, attempt }
  const r = await rewardCorrect(`answer:${attemptId}:${index}`, q, elapsedMs, now)
  return { correct, xp: r.awarded, capped: r.capped, reviewAdded: r.reviewAdded, attempt }
}

export const advance = (attemptId: string, position: number, now = new Date()) => attempts.setPosition(attemptId, position, now)

/** 重新開始本課：作廢目前的作答，下次進來重新出題 */
export const restart = (attemptId: string, now = new Date()) => attempts.close(attemptId, 'void', now)

export interface LessonOutcome {
  xp: number
  correct: number
  total: number
  seals: SealId[]
}

export async function completeLesson(attemptId: string, now = new Date()): Promise<LessonOutcome> {
  const a = await attempts.get(attemptId)
  if (!a || a.kind !== 'lesson') throw new RangeError('找不到這次課程作答')
  const lesson = lessonById(a.target)!
  const correct = a.answers.filter(x => x?.correct).length
  const total = a.questions.length
  await lessons.completeLesson(lesson.id, lesson.station.id, correct, total, now)
  const r = await xp.award({ key: `lesson:${lesson.id}`, source: 'lesson', amount: xp.XP_AMOUNTS.lesson, ref: attemptId }, now)
  if (a.status === 'active') await attempts.close(attemptId, 'done', now)
  return { xp: r.awarded, correct, total, seals: await checkSeals() }
}

export interface ExamOutcome {
  score: number
  passed: boolean
  /** 這次拿到的 XP：答對題目加上通過考核 */
  xp: number
  /** 晉升後的修為；沒有晉升為 null */
  rankUp: string | null
  reviewAdded: number
  seals: SealId[]
}

export async function submitExam(attemptId: string, now = new Date()): Promise<ExamOutcome> {
  const a = await attempts.requireActive(attemptId, now)
  if (!a || a.kind !== 'exam' || a.status !== 'active') throw new RangeError('找不到進行中的考核')
  if (a.answers.some(x => x === null)) throw new RangeError('還有題目沒有作答')
  const stationId = Number(a.target)
  const before = highestPassed(await exams.all())
  const score = scoreExam(a.questions, a.answers)
  const passed = isPassing(score)
  await exams.recordExam({ attemptId, stationId, score, passed }, now)
  let gained = 0
  let reviewAdded = 0
  for (const [i, q] of a.questions.entries()) {
    if (!isCorrect(q, a.answers[i])) continue
    const r = await rewardCorrect(`answer:${attemptId}:${i}`, q, a.answers[i]!.elapsedMs, now)
    gained += r.awarded
    if (r.reviewAdded) reviewAdded++
  }
  if (passed) gained += (await xp.award({ key: `exam:${stationId}`, source: 'exam', amount: xp.XP_AMOUNTS.exam, ref: attemptId }, now)).awarded
  await attempts.close(attemptId, 'done', now)
  const after = passed ? Math.max(before, stationId) : before
  return { score, passed, xp: gained, rankUp: after > before ? rankOf(after) : null, reviewAdded, seals: await checkSeals() }
}
