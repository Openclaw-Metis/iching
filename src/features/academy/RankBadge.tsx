// 修為摘要列：目前修為與通過的站數，點開抽屜看修為等級表。

import { useState } from 'react'
import { Drawer } from '../../components/Drawer.tsx'
import { STATION_NUMERALS, STATIONS } from '../../data/stations.ts'
import { RANKS, rankOf } from './ranks.ts'

export function RankBadge({ highest, total }: { highest: number; total: number }) {
  const [open, setOpen] = useState(false)
  const rank = rankOf(highest)
  return (
    <>
      <button type="button" className="rank-badge" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span>修為</span><b>{rank}</b>
        <span>通過 {highest}／8 站・總 XP {total}</span>
      </button>
      <Drawer open={open} title="修為等級" onClose={() => setOpen(false)}>
        <p className="note">起始為學徒，每通過一站考核晉升一階。</p>
        <ol className="rank-list">
          {RANKS.map((r, i) => (
            <li key={r} data-current={r === rank || undefined} data-done={i <= highest || undefined}>
              <b>{r}</b>
              <span>{i === 0 ? '起始' : `通過第${STATION_NUMERALS[i - 1]}站（${STATIONS[i - 1].trigram}・${STATIONS[i - 1].theme}）`}</span>
            </li>
          ))}
        </ol>
      </Drawer>
    </>
  )
}
