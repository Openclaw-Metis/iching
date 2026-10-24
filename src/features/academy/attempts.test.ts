import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { attempts as attemptsRepo, openStorage, provideStorage, requireDb, xp } from '../../storage/index.ts'
import { advance, answer, completeLesson, select, startAttempt, submitExam } from './attempts.ts'
import { answerPractice, practiceQuestions } from './practice.ts'

let factory: IDBFactory
beforeEach(async () => {
  factory = new IDBFactory()
  provideStorage(await openStorage({ indexedDB: factory, IDBKeyRange }))
})

// 模擬關掉分頁再打開：同一個資料庫重新連線
const reopen = async () => provideStorage(await openStorage({ indexedDB: factory, IDBKeyRange }))

const at = (d: number, h = 10, s = 0) => new Date(2026, 9, d, h, 0, s)

describe('作答進度（AC-30、TC-23）', () => {
  it('第 3 題中斷後回到同一題、同樣的選項順序與先前作答', async () => {
    const a = await startAttempt('lesson', 'S1-L2', at(24))
    expect(a.questions).toHaveLength(3)
    await answer(a.id, 0, a.questions[0].answerIndex, 1200, at(24))
    await advance(a.id, 3, at(24))
    await answer(a.id, 1, (a.questions[1].answerIndex + 1) % 4, 1500, at(24))
    await advance(a.id, 4, at(24))
    await select(a.id, 2, 1, at(24))

    await reopen()
    const back = await startAttempt('lesson', 'S1-L2', at(24, 18))
    expect(back.id).toBe(a.id)
    expect(back.position).toBe(4)
    expect(back.questions).toEqual(a.questions)
    expect(back.answers[0]).toMatchObject({ checked: true, correct: true })
    expect(back.answers[1]).toMatchObject({ checked: true, correct: false })
    expect(back.answers[2]).toMatchObject({ choice: 1, checked: false })
  })

  it('考核隔天回來是新的作答，前一天的作廢', async () => {
    const first = await startAttempt('exam', '1', at(24, 23))
    expect(first.questions).toHaveLength(10)
    expect((await startAttempt('exam', '1', at(24, 23, 30))).id).toBe(first.id)
    const next = await startAttempt('exam', '1', at(25, 0))
    expect(next.id).not.toBe(first.id)
    expect((await attemptsRepo.get(first.id))?.status).toBe('void')
  })

  it('完成之後不再接續，重新進入是新的作答', async () => {
    const a = await startAttempt('lesson', 'S1-L1', at(24))
    for (const [i, q] of a.questions.entries()) await answer(a.id, i, q.answerIndex, 2000, at(24))
    await completeLesson(a.id, at(24))
    expect((await attemptsRepo.get(a.id))?.status).toBe('done')
    const again = await startAttempt('lesson', 'S1-L1', at(24))
    expect(again.id).not.toBe(a.id)
  })

  it('檢查過的題目不能再改答案', async () => {
    const a = await startAttempt('lesson', 'S1-L3', at(24))
    await answer(a.id, 0, 0, 1000, at(24))
    await expect(answer(a.id, 0, 1, 1000, at(24))).rejects.toThrow()
  })
})

describe('XP（AC-15）', () => {
  it('完成一課只給一次課程 XP，答對題目給作答 XP', async () => {
    const a = await startAttempt('lesson', 'S1-L1', at(24))
    let answerXp = 0
    for (const [i, q] of a.questions.entries()) {
      const r = await answer(a.id, i, q.answerIndex, 2000, at(24, 10, i * 11))
      answerXp += 'xp' in r ? r.xp : 0
    }
    expect((await completeLesson(a.id, at(24))).xp).toBe(10)
    const b = await startAttempt('lesson', 'S1-L1', at(24, 11))
    for (const [i, q] of b.questions.entries()) await answer(b.id, i, q.answerIndex, 2000, at(24, 11, i * 11))
    expect((await completeLesson(b.id, at(24, 11))).xp).toBe(0)
    expect(answerXp).toBeGreaterThan(0)
    const events = await (await requireDb()).xpEvents.toArray()
    expect(events.filter(e => e.source === 'lesson')).toHaveLength(1)
  })

  it('考核通過只給一次考核 XP', async () => {
    for (const d of [24, 25]) {
      const a = await startAttempt('exam', '2', at(d))
      for (const [i, q] of a.questions.entries()) await answer(a.id, i, q.answerIndex, 2000, at(d))
      const r = await submitExam(a.id, at(d))
      expect(r.passed).toBe(true)
    }
    const events = await (await requireDb()).xpEvents.toArray()
    expect(events.filter(e => e.source === 'exam').map(e => e.key)).toEqual(['exam:2'])
  })

  it('同一 questionKey 10 秒內重複作答不給 XP', async () => {
    const [q] = practiceQuestions(new Set(), () => 1)
    expect((await answerPractice('s1', 0, q, q.answerIndex, at(24, 10, 0))).xp).toBe(2)
    expect((await answerPractice('s2', 0, q, q.answerIndex, at(24, 10, 5))).xp).toBe(0)
    expect((await answerPractice('s3', 0, q, q.answerIndex, at(24, 10, 11))).xp).toBe(2)
  })

  it('看圖猜卦練習優先抽還沒答對過的卦，答對寫入掌握紀錄', async () => {
    const mastered = new Set(Array.from({ length: 60 }, (_, i) => i + 1))
    const qs = practiceQuestions(mastered)
    expect(qs).toHaveLength(10)
    expect(qs.slice(0, 4).map(q => q.hexagram).sort()).toEqual([61, 62, 63, 64])
    await answerPractice('s', 0, qs[0], qs[0].answerIndex, at(24))
    expect(await (await requireDb()).mastery.get(`${qs[0].hexagram}:image`)).toBeTruthy()
    expect((await xp.summary(at(24))).today).toBe(2)
  })
})
