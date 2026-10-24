// 親手分蓍：在一束蓍草上點選（或拖曳、用左右鍵）分開的位置，程式完成掛一、揲四、歸奇。
// 點到最邊緣時夾到合法範圍：左堆至少一根，右堆掛一後也至少一根。

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { leftRange, type YarrowChange } from './yarrow.ts'

interface Props {
  remaining: number
  step: number
  lastChange: YarrowChange | null
  disabled?: boolean
  onSplit: (left: number) => void
}

const STICK = 6, GAP = 3, SPLIT = 18, HEIGHT = 70
const rest = (n: number) => n % 4 || 4

export function YarrowSplitter({ remaining, step, lastChange, disabled = false, onSplit }: Props) {
  const { min, max } = leftRange(remaining)
  const [cursor, setCursor] = useState(Math.round(remaining / 2))
  const [clamped, setClamped] = useState(false)
  const pressed = useRef(false)
  const svgRef = useRef<SVGSVGElement>(null)

  // 每一變開始時游標回到中間
  useEffect(() => { setCursor(Math.round(remaining / 2)); setClamped(false) }, [remaining, step])

  const place = (raw: number) => {
    const next = Math.min(max, Math.max(min, raw))
    setClamped(next !== raw)
    setCursor(next)
    return next
  }

  const fromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const r = svgRef.current!.getBoundingClientRect()
    return place(Math.round(((e.clientX - r.left) / r.width) * remaining))
  }

  const split = (left: number) => { if (!disabled) onSplit(left) }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1 }
    if (e.key in steps) { e.preventDefault(); place(cursor + steps[e.key] * (e.shiftKey ? 5 : 1)) }
    else if (e.key === 'Home') { e.preventDefault(); place(min) }
    else if (e.key === 'End') { e.preventDefault(); place(max) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); split(cursor) }
  }

  const width = remaining * (STICK + GAP) + SPLIT
  return (
    <div className="yarrow-splitter">
      <p className="cast-progress" aria-live="polite">分蓍中：第 {step} 步／共 18 步<small>本變有 {remaining} 根蓍草</small></p>
      <div
        className="splitter-track"
        role="slider"
        tabIndex={0}
        aria-label="分開蓍草的位置（左堆根數），按 Enter 分開"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={cursor}
        aria-valuetext={`左堆 ${cursor} 根，右堆 ${remaining - cursor} 根`}
        aria-disabled={disabled}
        onKeyDown={onKey}
      >
        <svg
          ref={svgRef}
          className="yarrow-bundle splitter-svg"
          viewBox={`0 0 ${width} ${HEIGHT}`}
          onPointerMove={e => { if (e.pointerType === 'mouse' || pressed.current) fromPointer(e) }}
          onPointerDown={e => { pressed.current = true; e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e) }}
          onPointerUp={e => { if (!pressed.current) return; pressed.current = false; split(fromPointer(e)) }}
          onPointerCancel={() => { pressed.current = false }}
        >
          {Array.from({ length: remaining }, (_, i) => (
            <rect key={i} x={i * (STICK + GAP) + (i >= cursor ? SPLIT : 0)} y="8" width={STICK} height={HEIGHT - 16} rx="1.5" />
          ))}
          <line className="split-cursor" x1={cursor * (STICK + GAP) + SPLIT / 2 - GAP / 2} x2={cursor * (STICK + GAP) + SPLIT / 2 - GAP / 2} y1="0" y2={HEIGHT} />
        </svg>
      </div>
      <p className="splitter-counts">
        <span>左堆 {cursor} 根</span>
        <span>右堆 {remaining - cursor} 根</span>
      </p>
      {clamped && <p className="inline-warning" role="status">每一堆至少要有一根。</p>}
      <button type="button" className="btn btn-primary" disabled={disabled} onClick={() => split(cursor)}>在這裡分開</button>

      {lastChange && (
        <ol className="yarrow-result" aria-label="上一變的結果">
          <li><b>分二</b>{lastChange.start} 根分為左 {lastChange.left}、右 {lastChange.start - lastChange.left}</li>
          <li><b>掛一</b>從右堆取一根掛起</li>
          <li><b>揲四</b>四根一數，左餘 {rest(lastChange.left)}、右餘 {rest(lastChange.start - lastChange.left - 1)}</li>
          <li><b>歸奇</b>共去 {lastChange.removed} 根，餘 {lastChange.remaining} 根</li>
        </ol>
      )}
    </div>
  )
}
