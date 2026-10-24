// 收藏卦牌的星號。保存層不能用時不顯示。

import { toast } from '../../app/toast.ts'
import { favorites, useDb, useLiveQuery } from '../../storage/index.ts'
import { toggleFavorite } from './favorites.ts'

export function FavoriteButton({ hexagram, label }: { hexagram: number; label: string }) {
  const db = useDb()
  const on = useLiveQuery<boolean | undefined>(() => (db ? favorites.hasOf(db, hexagram) : undefined), [db, hexagram])
  if (on === undefined) return null
  const toggle = async () => {
    try {
      const next = await toggleFavorite(hexagram)
      toast(next ? `已收藏${label}` : `已取消收藏${label}`)
    } catch {
      toast('沒有存起來，請再試一次。')
    }
  }
  return (
    <button type="button" className="fav-button" aria-pressed={on} aria-label={on ? `取消收藏${label}` : `收藏${label}`} onClick={() => void toggle()}>
      <span aria-hidden="true">{on ? '★' : '☆'}</span>{on ? '已收藏' : '收藏'}
    </button>
  )
}
