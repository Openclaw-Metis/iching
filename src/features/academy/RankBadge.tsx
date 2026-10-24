// 修為摘要列：目前修為、通過的站數與連續天數，點開抽屜看修為等級表與印譜。

import { useState } from 'react'
import { Drawer } from '../../components/Drawer.tsx'
import { STATION_NUMERALS, STATIONS } from '../../data/stations.ts'
import { RANKS, rankOf } from './ranks.ts'
import { SealBook } from './SealBook.tsx'

interface Props {
  highest: number
  total: number
  streak: number
  best: number
}

export function RankBadge({ highest, total, streak, best }: Props) {
  const [open, setOpen] = useState(false)
  const rank = rankOf(highest)
  return (
    <>
      <button type="button" className="rank-badge" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span>修為</span><b>{rank}</b>
        <span>通過 {highest}／8 站・總 XP {total}・連續 {streak} 天</span>
      </button>
      <Drawer open={open} title="修為與印譜" onClose={() => setOpen(false)}>
        <p className="note">連續達成每日目標 {streak} 天，最長 {best} 天。</p>
        <p className="note">起始為學徒，每通過一站考核晉升一階。</p>
        <ol className="rank-list">
          {RANKS.map((r, i) => (
            <li key={r} data-current={r === rank || undefined} data-done={i <= highest || undefined}>
              <b>{r}</b>
              <span>{i === 0 ? '起始' : `通過第${STATION_NUMERALS[i - 1]}站（${STATIONS[i - 1].trigram}・${STATIONS[i - 1].theme}）`}</span>
            </li>
          ))}
        </ol>
        <h3 className="drawer-sub">印譜</h3>
        <SealBook />
      </Drawer>
    </>
  )
}
