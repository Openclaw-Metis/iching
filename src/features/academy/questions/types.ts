// 學堂的 14 種題型（規格「學堂內容設計」）。全部是 4 選 1 或是非，不做點選卦畫與配對。
// 題目以 QuestionSnapshot 的形狀產生，作答進度直接存整份快照，出題器之後更新也不影響進行中的作答。

import type { Bit } from '../../../data/trigrams.ts'
import type { Facet, QuestionSnapshot } from '../../../storage/index.ts'

export const QUESTION_TYPES = [
  'glyph-to-name', 'name-to-glyph', 'trigram', 'pair-to-name', 'daxiang-to-name', 'image-to-name', 'relation',
  'line-label', 'line-position', 'sequence', 'text-kind', 'reading-rule', 'position', 'method-probability',
] as const

export type QuestionType = (typeof QUESTION_TYPES)[number]

/** 題幹：文字加上要畫的卦畫、要標出的爻或要顯示的看圖卡 */
export interface Prompt {
  text: string
  /** 六爻或三爻，由下而上 */
  glyph?: Bit[]
  /** 卦畫中標出的爻（0 起算） */
  highlight?: number
  /** 卦畫中以朱紅標出的變爻 */
  moving?: number[]
  /** 看圖猜卦：quiz.webp 的卦序 */
  image?: number
  [extra: string]: unknown
}

export interface Option {
  /** 顯示與無障礙名稱；選項是卦畫時寫成文字描述 */
  label: string
  glyph?: Bit[]
  [extra: string]: unknown
}

export interface Question extends QuestionSnapshot {
  type: QuestionType
  prompt: Prompt
  options: Option[]
  facet?: Facet
}

/** 題型的參數；沒有指定時由出題器自行決定 */
export interface QuestionParams {
  /** 只從這些卦出題（卦序） */
  hexagrams?: number[]
  /** 題型內的變化，如 trigram 的 glyph-name、relation 的 cuo、position 的 proper */
  variant?: string
}
