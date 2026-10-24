// 一枚印章：朱紅方印，印面一個字。未取得時是淡墨的空框。

import type { SealId } from '../../storage/index.ts'
import { sealInfo } from './seals.ts'

export function SealStamp({ id, earned, size = 'md' }: { id: SealId; earned: boolean; size?: 'sm' | 'md' }) {
  const info = sealInfo(id)
  return (
    <span className="seal-stamp" data-earned={earned || undefined} data-size={size} aria-label={`${info.char}印${earned ? '，已取得' : '，尚未取得'}`} role="img">
      {info.char}
    </span>
  )
}
