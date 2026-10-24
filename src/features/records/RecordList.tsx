// 紀錄列表：搜尋與篩選（方法、類別、是否回顧、星號），每頁 50 筆，捲到底以游標載入下一頁。
// 每一頁各自訂閱資料，另一個分頁修改後畫面自動更新；篩選條件記在 localStorage。

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { HexagramGlyph } from '../../components/HexagramGlyph.tsx'
import { hexagram } from '../../data/hexagrams.ts'
import { formatDateTime } from '../../lib/dates.ts'
import { readings, useDb, useLiveQuery, type Category, type Method } from '../../storage/index.ts'
import { CATEGORY_LABELS, METHOD_LABELS } from '../divination/index.ts'

type Reviewed = '' | 'yes' | 'no'

export interface RecordFilters {
  query: string
  method: Method | ''
  category: Category | ''
  reviewed: Reviewed
  starred: boolean
}

const EMPTY: RecordFilters = { query: '', method: '', category: '', reviewed: '', starred: false }
const FILTER_KEY = 'iching:me-filters'

function loadFilters(): RecordFilters {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(FILTER_KEY) ?? '{}') } } catch { return EMPTY }
}

const toQuery = (f: RecordFilters): readings.ListFilters => ({
  query: f.query || undefined,
  method: f.method || undefined,
  category: f.category || undefined,
  reviewed: f.reviewed === '' ? undefined : f.reviewed === 'yes',
  starred: f.starred || undefined,
})

const isFiltered = (f: RecordFilters) => Object.entries(f).some(([k, v]) => v !== EMPTY[k as keyof RecordFilters])

function RecordPage({ filters, cursor, last, onNext }: { filters: RecordFilters; cursor?: readings.Cursor; last: boolean; onNext: (c: readings.Cursor) => void }) {
  const db = useDb()
  const key = JSON.stringify(filters)
  const page = useLiveQuery(() => (db ? readings.queryList(db, toQuery(filters), { before: cursor }) : undefined), [db, key, cursor?.createdAt, cursor?.id])
  const sentinel = useRef<HTMLDivElement>(null)

  // 最後一頁的底部出現在畫面上時載入下一頁
  useEffect(() => {
    const el = sentinel.current
    const next = page?.next
    if (!el || !next || !last || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) onNext(next) })
    io.observe(el)
    return () => io.disconnect()
  }, [page?.next, last, onNext])

  if (!page) return null
  return (
    <>
      {page.items.map(r => {
        const primary = hexagram(r.primary), result = hexagram(r.result)
        return (
          <li key={r.id}>
            <Link to={`/me?record=${r.id}`} className="record-item">
              <span className="record-date">{formatDateTime(r.createdAt)}</span>
              <span className="record-question">{r.question}</span>
              <span className="record-hex">
                <HexagramGlyph lines={primary.lines} moving={r.moving} />
                {primary.name}
                {r.moving.length > 0 && <>　→　<HexagramGlyph lines={result.lines} />{result.name}</>}
              </span>
              <span className="record-tags">
                {r.starred === 1 && <span className="tag-star" aria-label="已加星號">★</span>}
                {r.followUp && <span className="chip">已回顧</span>}
                <span>{METHOD_LABELS[r.method]}</span>
              </span>
            </Link>
          </li>
        )
      })}
      {last && page.next && (
        <li className="record-more" ref={sentinel as never}>
          <button type="button" className="btn" onClick={() => onNext(page.next!)}>載入更多</button>
        </li>
      )}
    </>
  )
}

export function RecordList({ onRestoreBackup }: { onRestoreBackup?: () => void }) {
  const [filters, setFilters] = useState<RecordFilters>(loadFilters)
  const [open, setOpen] = useState(false)
  const [cursors, setCursors] = useState<(readings.Cursor | undefined)[]>([undefined])
  const db = useDb()
  const total = useLiveQuery<number | undefined>(() => (db ? db.readings.filter(r => !r.deletedAt).count() : undefined), [db])
  const first = useLiveQuery(() => (db ? readings.queryList(db, toQuery(filters), { limit: 1 }) : undefined), [db, JSON.stringify(filters)])

  const update = (patch: Partial<RecordFilters>) => {
    const next = { ...filters, ...patch }
    setFilters(next)
    setCursors([undefined])
    try { localStorage.setItem(FILTER_KEY, JSON.stringify(next)) } catch { /* 偏好記不住而已 */ }
  }
  const onNext = (c: readings.Cursor) => setCursors(list => (list.some(x => x?.id === c.id) ? list : [...list, c]))

  if (total === 0) {
    return (
      <div className="empty-state">
        <p>還沒有任何占卜紀錄。</p>
        <div className="step-actions">
          <Link className="btn btn-primary" to="/divine">去占卜</Link>
          {onRestoreBackup && <button type="button" className="btn" onClick={onRestoreBackup}>從備份還原</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="record-list">
      <div className="record-toolbar">
        <input className="search" type="search" placeholder="搜尋問題、筆記、回顧" value={filters.query} onChange={e => update({ query: e.target.value })} aria-label="搜尋紀錄" />
        <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen(o => !o)}>篩選{isFiltered({ ...filters, query: '' }) ? '・已套用' : ''}</button>
      </div>
      {open && (
        <div className="record-filters">
          <label>方法
            <select value={filters.method} onChange={e => update({ method: e.target.value as Method | '' })}>
              <option value="">全部</option>
              {(Object.keys(METHOD_LABELS) as Method[]).map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
            </select>
          </label>
          <label>類別
            <select value={filters.category} onChange={e => update({ category: e.target.value as Category | '' })}>
              <option value="">全部</option>
              {(Object.keys(CATEGORY_LABELS) as Category[]).map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </label>
          <label>事後回顧
            <select value={filters.reviewed} onChange={e => update({ reviewed: e.target.value as Reviewed })}>
              <option value="">全部</option>
              <option value="yes">已回顧</option>
              <option value="no">未回顧</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={filters.starred} onChange={e => update({ starred: e.target.checked })} />只看加星號
          </label>
          <button type="button" className="link-button" onClick={() => update(EMPTY)}>清除篩選</button>
        </div>
      )}
      {first && first.items.length === 0 ? (
        <div className="empty-state">
          <p>沒有符合條件的紀錄。</p>
          <button type="button" className="btn" onClick={() => update(EMPTY)}>清除篩選</button>
        </div>
      ) : (
        <ul className="records">
          {cursors.map((c, i) => <RecordPage key={c?.id ?? 'first'} filters={filters} cursor={c} last={i === cursors.length - 1} onNext={onNext} />)}
        </ul>
      )}
    </div>
  )
}
