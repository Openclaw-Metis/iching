import type { Bit } from '../data/trigrams.ts'

interface Props {
  lines: readonly Bit[]
  className?: string
  moving?: number[]
  /** 框起來標示的爻（0 起算），學堂題目用 */
  highlight?: number
}

/** 卦畫：由下而上的爻，畫成由上而下排列的橫條 */
export function HexagramGlyph({ lines, className = 'glyph', moving = [], highlight }: Props) {
  const n = lines.length
  const bar = 10, gap = 7, h = n * bar + (n - 1) * gap
  // 有標示時四周留出框線的位置，卦畫本身大小不變
  const pad = highlight === undefined ? 0 : 5
  return (
    <svg className={`hexglyph ${className}`} viewBox={`${-pad} ${-pad} ${60 + pad * 2} ${h + pad * 2}`} aria-hidden="true">
      {highlight !== undefined && (
        <rect className="glyph-mark" x={-4} y={(n - 1 - highlight) * (bar + gap) - 4} width={68} height={bar + 8} rx="3" fill="none" strokeWidth="2" />
      )}
      {lines.map((bit, i) => {
        const y = (n - 1 - i) * (bar + gap)
        const fill = moving.includes(i) ? 'var(--vermilion)' : undefined
        return bit
          ? <rect key={i} x="0" y={y} width="60" height={bar} rx="1.5" style={{ fill }} />
          : <g key={i} style={{ fill }}><rect x="0" y={y} width="25" height={bar} rx="1.5" /><rect x="35" y={y} width="25" height={bar} rx="1.5" /></g>
      })}
    </svg>
  )
}
