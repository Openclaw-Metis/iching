// 我的頁「收藏」：卡牌牆（縮圖維持 5:7，依加入時間）與金句列表（點擊回到卡牌頁的那一句）。

import { Link } from 'react-router'
import { CardThumb } from '../../components/CardThumb.tsx'
import { hexagram } from '../../data/hexagrams.ts'
import { favorites, quotes, useDb, useLiveQuery, type Favorite, type Quote } from '../../storage/index.ts'
import { QuoteButton } from './QuoteButton.tsx'
import { quoteHref, quoteSource, quoteText, type QuoteRef } from './quotes.ts'

const refOf = (q: Quote): QuoteRef => ({ hexagram: q.hexagram, kind: q.kind, ...(q.kind === 'line' ? { position: q.position } : {}) })

export function CollectionTab() {
  const db = useDb()
  const favs = useLiveQuery<Favorite[] | undefined>(() => (db ? favorites.listOf(db) : undefined), [db])
  const qs = useLiveQuery<Quote[] | undefined>(() => (db ? quotes.listOf(db) : undefined), [db])
  if (!favs || !qs) return null

  return (
    <div className="collection">
      <section>
        <h3>卦牌</h3>
        {favs.length === 0
          ? <p className="note">還沒有收藏卦牌。在卡牌頁或占卜解讀點「收藏」就會出現在這裡。</p>
          : <div className="fav-wall">{favs.map(f => <CardThumb key={f.hexagram} hex={hexagram(f.hexagram)} />)}</div>}
      </section>
      <section>
        <h3>金句</h3>
        {qs.length === 0
          ? <p className="note">還沒有收藏句子。在卡牌頁的經文分頁或占卜解讀點書籤就會出現在這裡。</p>
          : (
              <ul className="quote-list">
                {qs.map(q => {
                  const ref = refOf(q)
                  return (
                    <li key={q.id}>
                      <Link to={quoteHref(ref)}>
                        <span className="classic">{quoteText(ref)}</span>
                        <span className="quote-source">{quoteSource(ref)}</span>
                      </Link>
                      <QuoteButton quote={ref} />
                    </li>
                  )
                })}
              </ul>
            )}
      </section>
    </div>
  )
}
