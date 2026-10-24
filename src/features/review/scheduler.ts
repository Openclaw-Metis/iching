// ts-fsrs 的包裝（規格「溫故與學習地圖」）：預設參數，目標記憶保留率 0.9、最長間隔 365 天、開啟間隔隨機微調。
// 作答評分：答錯 Again、答對 Good、3 秒內答對 Easy。卡片在資料庫裡存成 ISO 字串（FsrsCardData），
// 這裡負責與 ts-fsrs 的 Card 互轉。ts-fsrs 只在 features/review 使用，不進保存層與卦殿首屏。

import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs'
import type { FsrsCardData } from '../../storage/index.ts'

const scheduler = fsrs({ request_retention: 0.9, maximum_interval: 365, enable_fuzz: true })

export const EASY_MS = 3000

export function ratingFor(correct: boolean, elapsedMs: number): Grade {
  if (!correct) return Rating.Again
  return elapsedMs < EASY_MS ? Rating.Easy : Rating.Good
}

export function toCard(d: FsrsCardData): Card {
  return {
    due: new Date(d.due), stability: d.stability, difficulty: d.difficulty, elapsed_days: d.elapsed_days,
    scheduled_days: d.scheduled_days, learning_steps: d.learning_steps, reps: d.reps, lapses: d.lapses, state: d.state,
    ...(d.last_review ? { last_review: new Date(d.last_review) } : {}),
  }
}

export function fromCard(c: Card): FsrsCardData {
  return {
    due: c.due.toISOString(), stability: c.stability, difficulty: c.difficulty, elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days, learning_steps: c.learning_steps, reps: c.reps, lapses: c.lapses, state: c.state as FsrsCardData['state'],
    ...(c.last_review ? { last_review: c.last_review.toISOString() } : {}),
  }
}

/** 新卡：立即到期 */
export const newCard = (now: Date): FsrsCardData => fromCard(createEmptyCard(now))

export function schedule(card: FsrsCardData, grade: Grade, now: Date): FsrsCardData {
  return fromCard(scheduler.next(toCard(card), now, grade).card)
}

/** 記憶程度 0 到 1；第三個參數必須是 false 才回傳數值（預設回傳文字） */
export const retrievability = (card: FsrsCardData, now: Date): number => scheduler.get_retrievability(toCard(card), now, false)
