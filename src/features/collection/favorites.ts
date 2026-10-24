// 收藏卦牌：卡牌頁與解讀頁點星號切換。

import { track } from '../../lib/events.ts'
import { favorites } from '../../storage/index.ts'

export async function toggleFavorite(hexagram: number): Promise<boolean> {
  if (!Number.isInteger(hexagram) || hexagram < 1 || hexagram > 64) throw new RangeError(`沒有第 ${hexagram} 卦`)
  const on = await favorites.toggle(hexagram)
  track('favorite_toggled', { hexagram, on })
  return on
}
