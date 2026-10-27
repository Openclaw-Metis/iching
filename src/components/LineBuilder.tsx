// 起卦的卦畫：六個爻值（6、7、8、9）畫成由下往上的爻位。資料一律初爻在前（index 0）。
// 變爻以朱紅標記：老陽（9）畫小圈，老陰（6）畫叉。起卦進行中（live）才載入金粉場景並在爻旁註明老少陰陽，
// 解讀與摘要只用 CSS。

import { useMemo } from 'react'
import { isMoving, lineBit, type LineValue } from '../lib/castLines.ts'
import { LineForge } from './LineForge.tsx'

const NAMES: Record<LineValue, string> = { 6: '老陰', 7: '少陽', 8: '少陰', 9: '老陽' }
const ORDINAL = ['初', '二', '三', '四', '五', '上']

interface Props {
  lines: readonly LineValue[]
  live?: boolean
  className?: string
}

export function LineBuilder({ lines, live = false, className = '' }: Props) {
  const forge = useMemo(
    () => Array.from({ length: 6 }, (_, i) => {
      const v = lines[i]
      const note = live ? (v === undefined ? '' : `${NAMES[v]}・${v}`) : undefined
      return v === undefined ? { bit: null, note } : { bit: lineBit(v), moving: isMoving(v), note }
    }),
    [lines, live],
  )
  const described = lines.map((v, i) => `${ORDINAL[i]}爻${NAMES[v]}`).join('、')
  return (
    <LineForge
      className={`line-builder ${className}`}
      lines={forge}
      label={lines.length ? `已成 ${lines.length} 爻，由下而上：${described}` : '尚未起卦'}
      eager={live}
      still={!live}
    />
  )
}
