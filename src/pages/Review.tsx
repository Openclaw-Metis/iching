// 溫故頁：題目用學堂的出題器與題目卡，卦畫卡出卦畫認卦名、看圖卡出看圖認卦名。

import { checkAndAnnounce, generateQuestion, QuestionCard } from '../features/academy/index.ts'
import { ReviewSession } from '../features/review/index.ts'
import type { ReviewCard } from '../storage/index.ts'

const makeQuestion = (card: ReviewCard) =>
  generateQuestion(card.facet === 'image' ? 'image-to-name' : 'glyph-to-name', { hexagrams: [card.hexagram] })

export function Review() {
  return <ReviewSession makeQuestion={makeQuestion} QuestionView={QuestionCard} onRoundComplete={() => void checkAndAnnounce()} />
}
