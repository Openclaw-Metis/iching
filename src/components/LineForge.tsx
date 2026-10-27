// 六爻爻位（規格「經冊與畫卦」）：卦殿畫卦與占卜起卦共用。資料初爻在前（index 0），畫面由下而上。
// 先以 CSS 畫出卦畫；瀏覽器能用 WebGL 且沒有要求減少動態效果時，再以 import() 載入金粉場景蓋在上面。
// 場景失敗時退回 CSS，按鈕與鍵盤操作兩者相同。

import { useEffect, useRef, useState } from 'react'
import type { Bit } from '../data/trigrams.ts'
import type { ForgeScene } from './forge/forgeScene.ts'

export interface ForgeLine {
  bit: Bit | null
  moving?: boolean
  /** 爻旁的小字，例如起卦時的「老陽」 */
  note?: string
}

interface Props {
  lines: readonly ForgeLine[]
  /** 整組的名稱；不可點時當作圖片的替代文字 */
  label: string
  /** 有值時每一爻都是按鈕 */
  onLine?: (index: number) => void
  lineLabel?: (index: number) => string
  /** 一掛載就載入金粉場景（起卦）；否則等第一爻畫上或指標移入時才載入（卦殿） */
  eager?: boolean
  /** 只用 CSS 卦畫，不載入金粉場景（解讀頁、摘要等不再變動的卦畫） */
  still?: boolean
  className?: string
}

const ORDINAL = ['初', '二', '三', '四', '五', '上']

function canUseGl() {
  return typeof window !== 'undefined' && 'WebGLRenderingContext' in window
    && !matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function LineForge({ lines, label, onLine, lineLabel, eager = false, still = false, className = '' }: Props) {
  const glHost = useRef<HTMLDivElement>(null)
  const bars = useRef<(HTMLSpanElement | null)[]>([])
  const scene = useRef<ForgeScene | null>(null)
  const latest = useRef(lines)
  latest.current = lines
  const [want, setWant] = useState(eager)
  const [gl, setGl] = useState(false)
  const drawn = lines.some(l => l.bit !== null)

  useEffect(() => { if (drawn) setWant(true) }, [drawn])

  useEffect(() => {
    if (!want || still || !canUseGl()) return
    let alive = true
    const measure = () => {
      const base = glHost.current!.getBoundingClientRect()
      return bars.current.map(el => {
        const r = el!.getBoundingClientRect()
        return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }
      })
    }
    import('./forge/forgeScene.ts').then(m => {
      if (!alive || !glHost.current) return
      // 建立失敗時回呼會在 createForgeScene 回傳前就被呼叫，所以先宣告為 null
      let created: ForgeScene | null = null
      created = m.createForgeScene(glHost.current, measure, msg => {
        console.warn(`[WEBGL_UNAVAILABLE] ${msg}`)
        created?.dispose()
        scene.current = null
        setGl(false)
      })
      if (!created) return
      scene.current = created
      created.set(toSlots(latest.current), true)
      setGl(true)
    }, () => { /* 載不到就維持 CSS 卦畫 */ })
    return () => {
      alive = false
      scene.current?.dispose()
      scene.current = null
    }
  }, [want, still])

  useEffect(() => { scene.current?.set(toSlots(lines)) }, [lines])

  const wake = () => setWant(true)
  return (
    <div
      className={`forge ${className}`}
      role={onLine ? 'group' : 'img'}
      aria-label={label}
      data-gl={gl || undefined}
      onPointerEnter={onLine ? wake : undefined}
      onFocus={onLine ? wake : undefined}
    >
      <div className="forge-gl" ref={glHost} />
      {lines.map((l, i) => {
        const inner = (
          <>
            <span className="forge-ord" aria-hidden="true">{ORDINAL[i]}</span>
            <span className="forge-bar" ref={el => { bars.current[i] = el }}><i /><i /></span>
            <span className="forge-mark" aria-hidden="true" />
            {l.note !== undefined && <span className="forge-note" aria-hidden="true">{l.note}</span>}
          </>
        )
        const data = { 'data-bit': l.bit ?? undefined, 'data-moving': (l.bit !== null && l.moving) || undefined }
        return onLine
          ? <button key={i} type="button" className="forge-line" {...data} aria-label={lineLabel?.(i)} onClick={() => onLine(i)}>{inner}</button>
          : <span key={i} className="forge-line" {...data}>{inner}</span>
      })}
    </div>
  )
}

const toSlots = (lines: readonly ForgeLine[]) => lines.map(l => ({ bit: l.bit, moving: Boolean(l.moving) }))
