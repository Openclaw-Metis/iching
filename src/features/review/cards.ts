// 溫故卡的建立、加入與移出（規格「溫故與學習地圖」）。
// 第一次答對卦畫或看圖題時，卡不存在才建立，並立即以這次作答的評分排程一次，所以到期時間晚於現在；
// 曾被移出的卡（有 removedAt）不會重建。卡牌頁的「加入溫故」建立立即到期的新卡，或清除 removedAt。

import { review, type Facet, type ReviewCard } from '../../storage/index.ts'
import { newCard, ratingFor, schedule } from './scheduler.ts'

export const FACETS: Facet[] = ['glyph', 'image']

function build(hexagram: number, facet: Facet, now: Date, fsrs = newCard(now)): ReviewCard {
  const at = now.toISOString()
  return { id: review.cardId(hexagram, facet), hexagram, facet, fsrs, due: fsrs.due, addedAt: at, updatedAt: at, removedAt: null }
}

/** 學堂作答第一次答對時呼叫；回傳是否新建了卡 */
export function addFromAnswer(hexagram: number, facet: Facet, elapsedMs: number, now = new Date()): Promise<boolean> {
  return review.createIfAbsent(build(hexagram, facet, now, schedule(newCard(now), ratingFor(true, elapsedMs), now)))
}

/** 成就補發：掌握紀錄有、卡卻不存在時，以第一次答對的時間與「良好」排程 */
export function addFromMastery(hexagram: number, facet: Facet, firstCorrectAt: string): Promise<boolean> {
  const at = new Date(firstCorrectAt)
  return review.createIfAbsent(build(hexagram, facet, at, schedule(newCard(at), ratingFor(true, Infinity), at)))
}

/** 卡牌頁「加入溫故」：兩個面向都加入；新卡立即到期，移出過的恢復 */
export async function addToReview(hexagram: number, now = new Date()): Promise<void> {
  for (const facet of FACETS) {
    const existing = await review.get(review.cardId(hexagram, facet))
    if (!existing) await review.createIfAbsent(build(hexagram, facet, now))
    else if (existing.removedAt) await review.put({ ...existing, removedAt: null, updatedAt: now.toISOString() })
  }
}

/** 卡牌頁「移出溫故」：只標記，不刪除 */
export async function removeFromReview(hexagram: number, now = new Date()): Promise<void> {
  for (const facet of FACETS) {
    const existing = await review.get(review.cardId(hexagram, facet))
    if (existing && !existing.removedAt) await review.put({ ...existing, removedAt: now.toISOString(), updatedAt: now.toISOString() })
  }
}
