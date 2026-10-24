import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ExamResult, LessonProgress } from '../../storage/index.ts'
import { attempts as attemptsRepo, openStorage, provideStorage, requireDb } from '../../storage/index.ts'
import { answer, startAttempt, submitExam } from './attempts.ts'
import { examStatus, lessonStatus, nextStep, scoreExam } from './grading.ts'

beforeEach(async () => provideStorage(await openStorage({ indexedDB: new IDBFactory(), IDBKeyRange })))

const NOW = new Date(2026, 9, 24, 10)
const done = (lessonId: string): LessonProgress => ({
  lessonId, stationId: Number(lessonId[1]), status: 'completed', step: 5, correct: 3, total: 3, completedAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
})
const exam = (stationId: number, passed: boolean): ExamResult => ({ id: crypto.randomUUID(), attemptId: 'a', stationId, score: passed ? 8 : 7, passed, at: NOW.toISOString() })

async function takeExam(correctCount: number) {
  const a = await startAttempt('exam', '1', NOW)
  for (const [i, q] of a.questions.entries()) {
    const choice = i < correctCount ? q.answerIndex : (q.answerIndex + 1) % q.options.length
    const r = await answer(a.id, i, choice, 3000, NOW)
    // 送出前不回傳對錯
    expect('correct' in r).toBe(false)
  }
  const stored = await attemptsRepo.get(a.id)
  expect(stored!.answers.every(x => x && !x.checked && !x.correct)).toBe(true)
  return submitExam(a.id, NOW)
}

describe('考核評分（AC-14）', () => {
  it('答對 8 題通過並晉升', async () => {
    const r = await takeExam(8)
    expect(r).toMatchObject({ score: 8, passed: true, rankUp: '識爻' })
    expect(r.xp).toBe(8 * 2 + 30)
  })

  it('答對 7 題不通過，不晉升也不給考核 XP', async () => {
    const r = await takeExam(7)
    expect(r).toMatchObject({ score: 7, passed: false, rankUp: null, xp: 14 })
  })

  it('還有題目沒作答時不能送出', async () => {
    const a = await startAttempt('exam', '1', NOW)
    await expect(submitExam(a.id, NOW)).rejects.toThrow()
  })

  it('scoreExam 只算選對的題', () => {
    const qs = [0, 1, 2].map(i => ({ questionKey: `k${i}`, type: 't', prompt: { text: '' }, options: [{ label: 'a' }, { label: 'b' }], answerIndex: i % 2, explanation: '' }))
    expect(scoreExam(qs, [{ choice: 0, checked: false, correct: false, elapsedMs: 0 }, null, { choice: 1, checked: false, correct: false, elapsedMs: 0 }])).toBe(1)
  })
})

describe('解鎖順序', () => {
  it('第一站第一課預設可學，其餘鎖住', () => {
    expect(lessonStatus('S1-L1', [], [])).toBe('available')
    expect(lessonStatus('S1-L2', [], [])).toBe('locked')
    expect(lessonStatus('S2-L1', [], [])).toBe('locked')
    expect(examStatus(1, [], [])).toBe('locked')
    expect(nextStep([], [])).toEqual({ kind: 'lesson', id: 'S1-L1' })
  })

  it('完成前一課開放下一課，三課完成開放考核', () => {
    const p1 = [done('S1-L1')]
    expect(lessonStatus('S1-L2', p1, [])).toBe('available')
    expect(lessonStatus('S1-L3', p1, [])).toBe('locked')
    const p3 = [done('S1-L1'), done('S1-L2'), done('S1-L3')]
    expect(examStatus(1, p3, [])).toBe('available')
    expect(nextStep(p3, [])).toEqual({ kind: 'exam', stationId: 1 })
  })

  it('考核通過才開放下一站第一課', () => {
    const p3 = [done('S1-L1'), done('S1-L2'), done('S1-L3')]
    expect(lessonStatus('S2-L1', p3, [exam(1, false)])).toBe('locked')
    expect(lessonStatus('S2-L1', p3, [exam(1, false), exam(1, true)])).toBe('available')
    expect(examStatus(1, p3, [exam(1, true)])).toBe('passed')
    expect(nextStep(p3, [exam(1, true)])).toEqual({ kind: 'lesson', id: 'S2-L1' })
  })
})

describe('考核通過（Gherkin）', () => {
  it('第二站考核答對 8 題：通過、修為晉升為識卦、印譜出現兌印、第三站第一課可學', async () => {
    const db = await requireDb()
    await db.lessonProgress.bulkAdd(['S1-L1', 'S1-L2', 'S1-L3', 'S2-L1', 'S2-L2', 'S2-L3'].map(done))
    await db.examResults.add(exam(1, true))
    const a = await startAttempt('exam', '2', NOW)
    for (const [i, q] of a.questions.entries()) await answer(a.id, i, i < 8 ? q.answerIndex : (q.answerIndex + 1) % q.options.length, 3000, NOW)
    const r = await submitExam(a.id, NOW)
    expect(r).toMatchObject({ score: 8, passed: true, rankUp: '識卦' })
    expect(r.seals).toContain('dui')
    expect(await db.seals.get('dui')).toBeTruthy()
    expect(lessonStatus('S3-L1', await db.lessonProgress.toArray(), await db.examResults.toArray())).toBe('available')
  })
})
