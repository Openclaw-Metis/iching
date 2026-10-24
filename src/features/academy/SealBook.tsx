// 印譜：15 枚印章與取得條件，已取得的標出日期。溫故關閉時不列「溫」印（見 isSealShown）。

import { formatDate } from '../../lib/dates.ts'
import { seals as sealsRepo, useDb, useLiveQuery, type Seal } from '../../storage/index.ts'
import { SealStamp } from './SealStamp.tsx'
import { shownSeals } from './seals.ts'

export function SealBook() {
  const db = useDb()
  const earned = useLiveQuery<Seal[] | undefined>(() => (db ? sealsRepo.allOf(db) : undefined), [db])
  if (!earned) return null
  const list = shownSeals()
  const at = new Map(earned.map(s => [s.id, s.earnedAt]))
  return (
    <section className="seal-book">
      <p className="note">已取得 {list.filter(s => at.has(s.id)).length}／{list.length} 枚。</p>
      <ul className="seal-grid">
        {list.map(s => (
          <li key={s.id} data-earned={at.has(s.id) || undefined}>
            <SealStamp id={s.id} earned={at.has(s.id)} />
            <span className="seal-cond">{s.condition}</span>
            <span className="seal-date">{at.has(s.id) ? formatDate(at.get(s.id)!) : '尚未取得'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
