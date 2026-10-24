import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { Rating } from 'ts-fsrs'
import { beforeEach, describe, expect, it } from 'vitest'
import { openStorage, provideStorage, requireDb, review, type ReviewCard } from '../../storage/index.ts'
import { addFromAnswer, addToReview, removeFromReview } from './cards.ts'
import { cellOf, mapState } from './mapOpacity.ts'
import { newCard, retrievability, schedule } from './scheduler.ts'
import { awardRound, grade, roundComplete, startSession } from './session.ts'

beforeEach(async () => provideStorage(await openStorage({ indexedDB: new IDBFactory(), IDBKeyRange })))

const NOW = new Date(2026, 9, 24, 10)
const later = (ms: number, from = NOW) => new Date(from.getTime() + ms)
const DAY = 86_400_000

function card(hexagram: number, facet: 'glyph' | 'image', fsrs = newCard(NOW), removedAt: string | null = null): ReviewCard {
  return { id: `${hexagram}:${facet}`, hexagram, facet, fsrs, due: fsrs.due, addedAt: NOW.toISOString(), updatedAt: NOW.toISOString(), removedAt }
}

describe('排程（TC-10）', () => {
  it('答錯後的到期時間早於答對', () => {
    const base = schedule(newCard(NOW), Rating.Good, NOW)
    const t = later(10 * DAY)
    const again = schedule(base, Rating.Again, t)
    const good = schedule(base, Rating.Good, t)
    expect(Date.parse(again.due)).toBeLessThan(Date.parse(good.due))
  })

  it('第一次答對建立的卡，到期時間晚於現在（AC-17）', async () => {
    expect(await addFromAnswer(29, 'image', 5000, NOW)).toBe(true)
    const c = await review.get('29:image')
    expect(Date.parse(c!.due)).toBeGreaterThan(NOW.getTime())
    expect(c!.due).toBe(c!.fsrs.due)
    expect(await addFromAnswer(29, 'image', 5000, NOW)).toBe(false)
  })

  it('記憶程度是數值', () => {
    const c = schedule(newCard(NOW), Rating.Good, NOW)
    const r = retrievability(c, later(DAY))
    expect(typeof r).toBe('number')
    expect(r).toBeGreaterThan(0)
    expect(r).toBeLessThanOrEqual(1)
  })
})

describe('加入與移出', () => {
  it('移出的卡不在待溫清單，答對也不會建回；再加入就恢復', async () => {
    await addToReview(3, NOW)
    const db = await requireDb()
    expect((await review.dueCards(db, NOW)).map(c => c.id).sort()).toEqual(['3:glyph', '3:image'])
    await removeFromReview(3, later(1000))
    expect(await review.dueCards(db, later(2000))).toEqual([])
    expect(await review.dueCount(db, later(2000))).toBe(0)
    expect(await addFromAnswer(3, 'glyph', 1000, later(3000))).toBe(false)
    expect((await review.get('3:glyph'))!.removedAt).not.toBeNull()
    await addToReview(3, later(4000))
    expect((await review.get('3:glyph'))!.removedAt).toBeNull()
    expect(await review.dueCount(db, later(5000))).toBe(2)
  })
})

describe('一輪溫故', () => {
  async function seedDue(n: number) {
    const db = await requireDb()
    await db.reviewCards.bulkAdd(Array.from({ length: n }, (_, i) => card(i + 1, 'glyph', newCard(later(-(n - i) * 60_000)))))
  }

  it('最多 20 張、依到期時間排序；開始後才到期的卡不在集合裡', async () => {
    await seedDue(25)
    const s = await startSession(NOW)
    expect(s.cardIds).toHaveLength(20)
    expect(s.cardIds[0]).toBe('1:glyph')
    const db = await requireDb()
    await db.reviewCards.add(card(40, 'image', newCard(later(60_000))))
    expect(s.cardIds).not.toContain('40:image')
  })

  it('答過 10 張不同的卡完成一輪，答錯重現不重複計數', async () => {
    await seedDue(15)
    const s = await startSession(NOW)
    const answered = new Set<string>()
    for (const id of s.cardIds.slice(0, 9)) {
      await grade(s.sessionId, id, false, 2000, NOW)
      answered.add(id)
    }
    // 第 1 張答錯後再出現一次，仍只算一張
    await grade(s.sessionId, s.cardIds[0], true, 2000, NOW)
    answered.add(s.cardIds[0])
    expect(roundComplete(s, answered)).toBe(false)
    answered.add(s.cardIds[9])
    expect(roundComplete(s, answered)).toBe(true)
    expect(await (await requireDb()).reviewLogs.count()).toBe(10)
  })

  it('集合不到 10 張時全部答過就完成；同一場只給一次 XP', async () => {
    await seedDue(3)
    const s = await startSession(NOW)
    expect(roundComplete(s, new Set(s.cardIds.slice(0, 2)))).toBe(false)
    expect(roundComplete(s, new Set(s.cardIds))).toBe(true)
    expect((await awardRound(s.sessionId, NOW)).awarded).toBe(10)
    expect((await awardRound(s.sessionId, NOW)).awarded).toBe(0)
  })

  it('沒有待溫卡時不算完成', async () => {
    const s = await startSession(NOW)
    expect(s.cardIds).toEqual([])
    expect(roundComplete(s, new Set())).toBe(false)
  })
})

describe('學習地圖亮度（AC-18）', () => {
  const fresh = (h: number, facet: 'glyph' | 'image') => card(h, facet, schedule(newCard(NOW), Rating.Good, NOW))
  const t = later(60_000)

  it('單一面向：沒有卡、到期、記憶程度高、記憶程度低', () => {
    expect(cellOf([], t)).toEqual({ opacity: 0.35, due: false })
    expect(cellOf([card(1, 'glyph')], t)).toEqual({ opacity: 0.55, due: true })
    expect(cellOf([fresh(1, 'glyph')], t)).toEqual({ opacity: 1, due: false })
    // 學習中的卡間隔只有幾分鐘，記憶程度一直很高；畢業進入複習後，快到期時才約降到目標保留率 0.9
    const graduated = schedule(schedule(newCard(NOW), Rating.Good, NOW), Rating.Good, later(10 * 60_000))
    const c = card(1, 'glyph', graduated)
    const nearDue = later(-60_000, new Date(c.due))
    expect(retrievability(c.fsrs, nearDue)).toBeLessThan(0.95)
    expect(cellOf([c], nearDue)).toEqual({ opacity: 0.8, due: false })
  })

  it('兩個面向：取較低的記憶程度；任一張到期就是待溫；移出的卡不算', () => {
    const strong = fresh(2, 'glyph')
    const weakBase = fresh(2, 'image')
    // 讓 image 面向的上次複習早很多，記憶程度比較低
    const weak = { ...weakBase, fsrs: { ...weakBase.fsrs, last_review: new Date(NOW.getTime() - 20 * DAY).toISOString() } }
    expect(retrievability(weak.fsrs, t)).toBeLessThan(0.95)
    expect(cellOf([strong, weak], t)).toEqual({ opacity: 0.8, due: false })
    expect(cellOf([strong, fresh(2, 'image')], t)).toEqual({ opacity: 1, due: false })
    expect(cellOf([strong, card(2, 'image')], t)).toEqual({ opacity: 0.55, due: true })
    expect(cellOf([strong, { ...card(2, 'image'), removedAt: NOW.toISOString() }], t)).toEqual({ opacity: 1, due: false })
    expect(cellOf([{ ...strong, removedAt: NOW.toISOString() }], t)).toEqual({ opacity: 0.35, due: false })
  })

  it('mapState 涵蓋 64 卦並計算待溫張數', () => {
    const s = mapState([card(1, 'glyph'), card(1, 'image'), fresh(5, 'glyph')], t)
    expect(s.cells.size).toBe(64)
    expect(s.dueCount).toBe(2)
    expect(s.cells.get(64)).toEqual({ opacity: 0.35, due: false })
  })
})
