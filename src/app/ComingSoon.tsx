// 尚未完成的頁面先以占位頁上線：路徑可直接開啟、標題正確，導覽旗標打開前不會出現在頁首。

import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { hexagrams, type Hexagram } from '../data/hexagrams.ts'
import { routeFor, SITE_NAME } from './routes.ts'

export function ComingSoon() {
  const { pathname } = useLocation()
  const heading = routeFor(pathname)?.title.split('｜')[0] ?? SITE_NAME
  return (
    <section className="placeholder">
      <h1>{heading}</h1>
      <p>這個功能即將推出。</p>
      <Link className="btn" to="/">回到卦殿</Link>
    </section>
  )
}

// 多半是想找某一卦卻打錯網址，所以直接給卦名或卦序搜尋；只找到一卦時直接前往（規格「2026-10-29 介面檢視後修訂」）
export function NotFound() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{ q: string; list: Hexagram[] } | null>(null)
  const search = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    const list = hexagrams.filter(h => h.fullName.includes(q) || String(h.number) === q)
    if (list.length === 1) void navigate(`/gua/${list[0].number}`)
    else setFound({ q, list })
  }
  return (
    <section className="placeholder">
      <h1>找不到這一頁</h1>
      <p>網址可能打錯了，或這一頁已經搬走。要找某一卦，可以搜尋卦名或卦序。</p>
      <form className="notfound-search" role="search" onSubmit={search}>
        <input className="search" type="search" aria-label="卦名或卦序" placeholder="例如：既濟、63" value={query} onChange={e => setQuery(e.target.value)} />
        <button type="submit" className="btn">前往</button>
      </form>
      {found && (found.list.length === 0
        ? <p role="status">沒有符合「{found.q}」的卦。</p>
        : (
          <ul className="notfound-list" aria-label={`符合「${found.q}」的卦`}>
            {found.list.map(h => <li key={h.number}><Link to={`/gua/${h.number}`}>{h.fullName}<small>第{h.number}卦</small></Link></li>)}
          </ul>
        ))}
      <Link className="btn" to="/">回到卦殿</Link>
    </section>
  )
}
