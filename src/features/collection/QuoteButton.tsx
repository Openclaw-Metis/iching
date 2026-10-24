// 收藏金句的書籤：經文分頁的卦辭、大象、每條爻辭與用九用六，以及解讀頁的主讀與輔讀。

import { toast } from '../../app/toast.ts'
import { quotes, useDb, useLiveQuery } from '../../storage/index.ts'
import { quoteIdOf, quoteSource, toggleQuote, type QuoteRef } from './quotes.ts'

export function QuoteButton({ quote }: { quote: QuoteRef }) {
  const db = useDb()
  const id = quoteIdOf(quote)
  const on = useLiveQuery<boolean | undefined>(() => (db ? quotes.hasOf(db, id) : undefined), [db, id])
  if (on === undefined) return null
  const source = quoteSource(quote)
  const toggle = async () => {
    try {
      const next = await toggleQuote(quote)
      toast(next ? `已收藏「${source}」` : `已取消收藏「${source}」`)
    } catch {
      toast('沒有存起來，請再試一次。')
    }
  }
  return (
    <button type="button" className="quote-button" aria-pressed={on} aria-label={on ? `取消收藏${source}` : `收藏${source}`} title={on ? '取消收藏這句' : '收藏這句'} onClick={() => void toggle()}>
      <svg viewBox="0 0 16 20" aria-hidden="true"><path d="M2 1h12v18l-6-4.5L2 19z" /></svg>
    </button>
  )
}
