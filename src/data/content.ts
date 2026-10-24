// 本站原創的牌義：整體牌義、白話導讀與問事指引。經文以原文為準，這裡的解說是協助理解的現代說法。
// 內容由 Claude、Codex、agy 三方撰稿與審校後定稿，存在 content.json；過程見 docs/content-review.md。

import data from './content.json'

export interface CardContent {
  keywords: string[]
  /** 一句話牌義 */
  motto: string
  /** 整體牌義：抽到這張牌整體在講的時勢與態度 */
  meaning: string
  /** 白話導讀：卦象、卦辭、彖傳、大象與六爻脈絡 */
  summary: string
  /** 問事指引 */
  guidance: { career: string; relations: string; decision: string }
}

export const content = data as Record<string, CardContent>
