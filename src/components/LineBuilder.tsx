// 起卦時由下往上長的卦畫。資料一律初爻在前（index 0），畫的時候才把初爻放在最下面。
// 變爻以朱紅標記：老陽（9）畫小圈，老陰（6）畫叉。

import type { LineValue } from '../lib/castLines.ts'

const NAMES: Record<LineValue, string> = { 6: '老陰', 7: '少陽', 8: '少陰', 9: '老陽' }
const ORDINAL = ['初', '二', '三', '四', '五', '上']

interface Props {
  lines: readonly LineValue[]
  total?: number
  /** 是否標出變爻（解讀時標，起卦中也標） */
  marks?: boolean
  className?: string
}

export function LineBuilder({ lines, total = 6, marks = true, className = '' }: Props) {
  const bar = 12, gap = 10, width = 96, markSpace = 22
  const height = total * bar + (total - 1) * gap
  const described = lines.map((v, i) => `${ORDINAL[i]}爻${NAMES[v]}`).join('、')
  return (
    <svg
      className={`line-builder ${className}`}
      viewBox={`0 0 ${width + markSpace} ${height}`}
      role="img"
      aria-label={lines.length ? `已成 ${lines.length} 爻，由下而上：${described}` : '尚未起卦'}
    >
      {Array.from({ length: total }, (_, i) => {
        const y = (total - 1 - i) * (bar + gap)
        const v = lines[i]
        if (v === undefined) return <rect key={i} className="lb-empty" x="0.5" y={y + 0.5} width={width - 1} height={bar - 1} rx="2" />
        const moving = marks && (v === 6 || v === 9)
        const cls = moving ? 'lb-line lb-moving' : 'lb-line'
        return (
          <g key={i} className={cls}>
            {v % 2 === 1
              ? <rect x="0" y={y} width={width} height={bar} rx="2" />
              : <><rect x="0" y={y} width={width * 0.42} height={bar} rx="2" /><rect x={width * 0.58} y={y} width={width * 0.42} height={bar} rx="2" /></>}
            {moving && (v === 9
              ? <circle className="lb-mark" cx={width + markSpace / 2} cy={y + bar / 2} r="6" />
              : <path className="lb-mark" d={`M${width + 5} ${y} l12 ${bar} M${width + 17} ${y} l-12 ${bar}`} />)}
          </g>
        )
      })}
    </svg>
  )
}
