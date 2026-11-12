// 民間占斷（規格「問事指引的民間占斷」）：坊間流傳的占卜說法經本站改寫，帶吉凶斷語與月份，和本站的指引分開呈現。
// 文字量不小，放在自己的檔案，問事指引出現在畫面上時才載入，占卜頁的程式包才不會超過上限。

export interface FolkReading {
  /** 民間稱呼，如「開創之數」 */
  title: string
  /** 總斷，接在「行動與決策」之下 */
  decision: string
  /** 身體與作息的養生提醒，不寫病名 */
  wellness: string
  career?: string
  relations?: string
}

export type FolkData = Record<string, FolkReading>

let cache: Promise<FolkData> | null = null

/** 載入並快取；失敗時清掉快取，下次可以重試 */
export function loadFolk(): Promise<FolkData> {
  cache ??= import('./folk.json').then(m => m.default as FolkData)
  cache.catch(() => { cache = null })
  return cache
}
