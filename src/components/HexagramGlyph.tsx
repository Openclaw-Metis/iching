import type { Bit } from '../data/trigrams.ts'

/** 卦畫：由下而上的爻，畫成由上而下排列的橫條 */
export function HexagramGlyph({ lines, className = 'glyph', moving = [] }: { lines: readonly Bit[]; className?: string; moving?: number[] }) {
  const n = lines.length
  const bar = 10, gap = 7, h = n * bar + (n - 1) * gap
  return (
    <svg className={`hexglyph ${className}`} viewBox={`0 0 60 ${h}`} aria-hidden="true">
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
