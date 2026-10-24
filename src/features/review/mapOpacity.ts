// 卦殿學習地圖的亮度（規格「溫故與學習地圖」）：只看該卦未移出的卡。
// 沒有卡 0.35（淡墨灰階）；任一張已到期 0.55 並加待溫小點；全部未到期時取較低的記憶程度，0.95 以上為 1，否則 0.8。

import { liveQuery, requireDb, review, type ReviewCard } from '../../storage/index.ts'
import { retrievability } from './scheduler.ts'

export interface MapCell {
  opacity: 0.35 | 0.55 | 0.8 | 1
  due: boolean
}

export interface MapState {
  cells: Map<number, MapCell>
  dueCount: number
}

export function cellOf(cards: ReviewCard[], now: Date): MapCell {
  const active = cards.filter(c => !c.removedAt)
  if (!active.length) return { opacity: 0.35, due: false }
  if (active.some(c => Date.parse(c.due) <= now.getTime())) return { opacity: 0.55, due: true }
  const lowest = Math.min(...active.map(c => retrievability(c.fsrs, now)))
  return { opacity: lowest >= 0.95 ? 1 : 0.8, due: false }
}

export function mapState(cards: ReviewCard[], now: Date): MapState {
  const byHex = new Map<number, ReviewCard[]>()
  for (const c of cards) byHex.set(c.hexagram, [...(byHex.get(c.hexagram) ?? []), c])
  const cells = new Map<number, MapCell>()
  for (let n = 1; n <= 64; n++) cells.set(n, cellOf(byHex.get(n) ?? [], now))
  const dueCount = cards.filter(c => !c.removedAt && Date.parse(c.due) <= now.getTime()).length
  return { cells, dueCount }
}

export async function mapOpacity(now = new Date()): Promise<MapState> {
  const db = await requireDb()
  return mapState(await review.allOf(db), now)
}

/** 卦殿用：卡片有變動（作答、加入、移出、另一個分頁）就重算；回傳取消訂閱 */
export function watchMap(onChange: (state: MapState) => void): () => void {
  let cancelled = false
  let unsubscribe = () => {}
  void requireDb().then(db => {
    if (cancelled) return
    const sub = liveQuery(() => review.allOf(db)).subscribe({ next: cards => onChange(mapState(cards, new Date())) })
    unsubscribe = () => sub.unsubscribe()
  })
  return () => {
    cancelled = true
    unsubscribe()
  }
}
