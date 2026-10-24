// 卡牌頁的「加入溫故／移出溫故」：一卦兩張卡（卦畫、看圖）一起加入或移出。
// 移出只標記 removedAt，之後答對也不會被自動建回；再按加入就恢復。

import { toast } from '../../app/toast.ts'
import { formatDateTime } from '../../lib/dates.ts'
import { review, useDb, useLiveQuery, type ReviewCard } from '../../storage/index.ts'
import { addToReview, removeFromReview } from './cards.ts'

export function ReviewToggle({ hexagram }: { hexagram: number }) {
  const db = useDb()
  const cards = useLiveQuery<ReviewCard[] | undefined>(() => (db ? review.ofHexagram(db, hexagram) : undefined), [db, hexagram])
  if (!cards) return null
  const active = cards.filter(c => !c.removedAt)
  const nextDue = active.map(c => c.due).sort()[0]

  const act = async (add: boolean) => {
    try {
      if (add) await addToReview(hexagram)
      else await removeFromReview(hexagram)
      toast(add ? '已加入溫故，到學堂的溫故就會出現' : '已移出溫故，之後不會自動加回')
    } catch {
      toast('沒有存起來，請再試一次。')
    }
  }

  return (
    <div className="review-toggle">
      {active.length > 0 ? (
        <>
          <span>溫故中・下次 {Date.parse(nextDue) <= Date.now() ? '現在' : formatDateTime(nextDue)}</span>
          <button type="button" className="btn" onClick={() => void act(false)}>移出溫故</button>
        </>
      ) : (
        <>
          <span>{cards.length ? '已移出溫故' : '還沒加入溫故'}</span>
          <button type="button" className="btn" onClick={() => void act(true)}>加入溫故</button>
        </>
      )}
    </div>
  )
}
