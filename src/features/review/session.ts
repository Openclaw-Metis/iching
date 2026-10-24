// 一輪溫故（規格「溫故與學習地圖」）：開始時取當下所有待溫卡，依到期時間排序最多 20 張，給一個 sessionId。
// 這一場答過的不同卡達 10 張，或集合內的卡全部答過，就完成一輪，給 10 XP（鍵 review:<sessionId>，每天最多 3 輪）。
// 答錯的卡在場內再出現不重複計數；開始後才到期的卡不在集合裡，不影響完成條件。

import { requireDb, review, xp, type ReviewCard } from '../../storage/index.ts'
import { ratingFor, schedule } from './scheduler.ts'

export const SESSION_SIZE = 20
export const ROUND_SIZE = 10

export interface Session {
  sessionId: string
  cardIds: string[]
}

export async function startSession(now = new Date()): Promise<Session> {
  const db = await requireDb()
  const cards = await review.dueCards(db, now, SESSION_SIZE)
  return { sessionId: crypto.randomUUID(), cardIds: cards.map(c => c.id) }
}

/** answered：這一場已答過的不同卡 */
export function roundComplete(session: Session, answered: ReadonlySet<string>): boolean {
  const inSet = session.cardIds.filter(id => answered.has(id)).length
  return session.cardIds.length > 0 && (inSet >= ROUND_SIZE || inSet === session.cardIds.length)
}

/** 依作答評分更新卡片並留下作答紀錄 */
export async function grade(sessionId: string, cardId: string, correct: boolean, elapsedMs: number, now = new Date()): Promise<ReviewCard> {
  const card = await review.get(cardId)
  if (!card) throw new RangeError(`沒有這張卡：${cardId}`)
  const rating = ratingFor(correct, elapsedMs)
  const fsrs = schedule(card.fsrs, rating, now)
  const at = now.toISOString()
  const next: ReviewCard = { ...card, fsrs, due: fsrs.due, updatedAt: at }
  await review.saveGraded(next, { id: crypto.randomUUID(), cardId, sessionId, rating, reviewedAt: at, elapsedMs })
  return next
}

/** 完成一輪時給 XP；同一場只給一次（業務鍵），每天最多 3 輪由 xp.award 檢查 */
export const awardRound = (sessionId: string, now = new Date()) =>
  xp.award({ key: `review:${sessionId}`, source: 'review', amount: xp.XP_AMOUNTS.review, ref: sessionId }, now)
