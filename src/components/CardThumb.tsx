import { Link } from 'react-router'
import type { CSSProperties, PointerEvent } from 'react'
import { cardAsset, hasArt } from '../data/cards.ts'
import type { Hexagram } from '../data/hexagrams.ts'

export type Relation = 'cuo' | 'zong' | 'hu'
const REL_LABEL: Record<Relation, string> = { cuo: '錯', zong: '綜', hu: '互' }

interface Props {
  hex: Hexagram
  relation?: Relation[]
  dim?: boolean
  /** 學習地圖：亮度（0.35、0.55、0.8、1）與是否待溫 */
  map?: { opacity: number; due: boolean }
  onFocus?: (hex: Hexagram | null) => void
}

// 圖錄保留卦牌比例，名稱另以文字呈現，縮圖較小時仍能讀取。
export function CardThumb({ hex, relation = [], dim = false, map, onFocus }: Props) {
  const tilt = (e: PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
    e.currentTarget.style.setProperty('--ry', `${x * 16}deg`)
    e.currentTarget.style.setProperty('--rx', `${-y * 12}deg`)
    e.currentTarget.style.setProperty('--sx', `${(0.5 - x) * 200}%`)
  }
  const reset = (e: PointerEvent<HTMLAnchorElement>) => {
    for (const p of ['--ry', '--rx', '--sx']) e.currentTarget.style.removeProperty(p)
    onFocus?.(null)
  }
  // 一張牌同時是錯卦又是綜卦時（例如泰否），標籤合併顯示
  const rel = relation[0]
  return (
    <Link
      to={`/gua/${hex.number}`}
      className="thumb"
      data-dim={dim}
      data-rel={rel}
      data-rel-label={relation.map(r => REL_LABEL[r]).join('・')}
      data-map={map ? String(map.opacity) : undefined}
      style={map ? { '--map-opacity': map.opacity } as CSSProperties : undefined}
      aria-label={`第${hex.number}卦 ${hex.fullName}${map?.due ? '，待溫' : ''}`}
      onPointerMove={tilt}
      onPointerEnter={() => onFocus?.(hex)}
      onPointerLeave={reset}
      onFocus={() => onFocus?.(hex)}
      onBlur={() => onFocus?.(null)}
    >
      <span className="thumb-media">
        <img src={cardAsset(hex.number, 'thumb')} alt="" loading="lazy" decoding="async" width={400} height={560} />
        {!hasArt(hex.number) && <span className="pending">插圖繪製中</span>}
        {map?.due && <span className="due-dot" aria-hidden="true" />}
      </span>
      <span className="thumb-caption" aria-hidden="true">
        <b>{hex.name}</b><span>第{hex.number}卦</span>
        <small>{hex.upper.name}上・{hex.lower.name}下</small>
      </span>
    </Link>
  )
}
