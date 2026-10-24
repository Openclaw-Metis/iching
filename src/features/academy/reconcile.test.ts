import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { maintenance, openStorage, provideStorage, requireDb, type Facet } from '../../storage/index.ts'
import { removeFromReview } from '../review/index.ts'
import { reconcileAchievements } from './reconcile.ts'

beforeEach(async () => provideStorage(await openStorage({ indexedDB: new IDBFactory(), IDBKeyRange })))

const NOW = new Date(2026, 9, 24, 10)

async function seed() {
  const db = await requireDb()
  await db.lessonProgress.bulkAdd(['S1-L1', 'S1-L2', 'S1-L3'].map((lessonId, i) => ({
    lessonId, stationId: 1, status: 'completed' as const, step: 5, correct: 3, total: 3, completedAt: `2026-10-0${i + 1}T09:00:00.000Z`, updatedAt: `2026-10-0${i + 1}T09:00:00.000Z`,
  })))
  await db.examResults.add({ id: 'e1', attemptId: 'a', stationId: 1, score: 9, passed: true, at: '2026-10-04T09:00:00.000Z' })
  await db.mastery.bulkAdd([
    { id: '3:glyph', hexagram: 3, facet: 'glyph', firstCorrectAt: '2026-10-02T09:00:00.000Z' },
    { id: '29:image', hexagram: 29, facet: 'image', firstCorrectAt: '2026-10-03T09:00:00.000Z' },
  ])
  await db.readings.add({
    id: 'r1', createdAt: '2026-10-05T09:00:00.000Z', updatedAt: '2026-10-05T09:00:00.000Z', rev: 1, question: '問題', category: 'general', method: 'yarrow-quick',
    lines: [7, 7, 7, 7, 7, 7], primary: 1, result: 1, moving: [], note: '', followUp: null, starred: 0, v: 1, deletedAt: null,
  })
}

describe('成就補發（AC-31）', () => {
  it('補發印章，取得時間為實際達成時間；建立缺少的溫故卡', async () => {
    await seed()
    expect(await reconcileAchievements(NOW)).toEqual({ sealsAdded: 3, cardsAdded: 2 })
    const db = await requireDb()
    const seals = Object.fromEntries((await db.seals.toArray()).map(s => [s.id, s.earnedAt]))
    expect(seals).toEqual({ first: '2026-10-01T09:00:00.000Z', qian: '2026-10-04T09:00:00.000Z', yarrow: '2026-10-05T09:00:00.000Z' })
    expect((await db.reviewCards.toArray()).map(c => c.id).sort()).toEqual(['29:image', '3:glyph'])
  })

  it('執行兩次結果相同', async () => {
    await seed()
    await reconcileAchievements(NOW)
    const db = await requireDb()
    const snapshot = async () => JSON.stringify([await db.seals.toArray(), await db.reviewCards.toArray(), await db.checkIns.toArray()])
    const first = await snapshot()
    expect(await reconcileAchievements(NOW)).toEqual({ sealsAdded: 0, cardsAdded: 0 })
    expect(await snapshot()).toBe(first)
  })

  it('移出溫故的卡不會被建回', async () => {
    await seed()
    await reconcileAchievements(NOW)
    await removeFromReview(3, NOW)
    await reconcileAchievements(NOW)
    const card = await (await requireDb()).reviewCards.get('3:glyph')
    expect(card?.removedAt).not.toBeNull()
  })

  it('重設學堂後路線回到初始，占卜紀錄與筮、錄印章保留', async () => {
    await seed()
    await reconcileAchievements(NOW)
    await maintenance.resetAcademy()
    const db = await requireDb()
    expect(await db.lessonProgress.count()).toBe(0)
    expect(await db.reviewCards.count()).toBe(0)
    expect(await db.mastery.count()).toBe(0)
    expect((await db.seals.toArray()).map(s => s.id)).toEqual(['yarrow'])
    expect(await db.readings.count()).toBe(1)
  })
})

describe('TC-24', () => {
  it('已完成第一站、答對 5 卦、移出其中 1 張溫故卡：補發初與乾印，建立 4 張卡，第二次沒有變動', async () => {
    const db = await requireDb()
    await db.lessonProgress.bulkAdd(['S1-L1', 'S1-L2', 'S1-L3'].map((lessonId, i) => ({
      lessonId, stationId: 1, status: 'completed' as const, step: 5, correct: 3, total: 3, completedAt: `2026-10-1${i}T09:00:00.000Z`, updatedAt: `2026-10-1${i}T09:00:00.000Z`,
    })))
    await db.examResults.add({ id: 'x1', attemptId: 'a', stationId: 1, score: 8, passed: true, at: '2026-10-13T09:00:00.000Z' })
    const answered: [number, Facet][] = [[1, 'glyph'], [2, 'glyph'], [3, 'image'], [4, 'glyph'], [5, 'image']]
    await db.mastery.bulkAdd(answered.map(([hexagram, facet]) => ({ id: `${hexagram}:${facet}`, hexagram, facet, firstCorrectAt: '2026-10-11T09:00:00.000Z' })))
    // 第 5 卦的卡曾被移出
    await reconcileAchievements(NOW)
    await removeFromReview(5, NOW)
    await db.reviewCards.where('hexagram').notEqual(5).delete()
    await db.seals.clear()

    expect(await reconcileAchievements(NOW)).toEqual({ sealsAdded: 2, cardsAdded: 4 })
    const seals = Object.fromEntries((await db.seals.toArray()).map(s => [s.id, s.earnedAt]))
    expect(seals).toEqual({ first: '2026-10-10T09:00:00.000Z', qian: '2026-10-13T09:00:00.000Z' })
    expect((await db.reviewCards.get('5:image'))?.removedAt).not.toBeNull()
    const snapshot = JSON.stringify([await db.seals.toArray(), await db.reviewCards.toArray()])
    expect(await reconcileAchievements(NOW)).toEqual({ sealsAdded: 0, cardsAdded: 0 })
    expect(JSON.stringify([await db.seals.toArray(), await db.reviewCards.toArray()])).toBe(snapshot)
  })
})
