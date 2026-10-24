// 連續天數（規格「XP 與每日目標」）：由打卡紀錄即時計算，不另存。今天還沒達標時從昨天往前數；
// 最長連續天數是打卡紀錄中最長的一段。七、卅兩枚印章取第一段連續 N 天的第 N 天達標時間。

import { addDays } from '../../lib/dates.ts'
import { xp, type CheckIn } from '../../storage/index.ts'

export const streakOf = (checkIns: Pick<CheckIn, 'date'>[], today: string) => xp.streaks(checkIns.map(c => c.date), today)

/** 依日期順序第一段達到 n 天的連續打卡，回傳第 n 天的達標時間；沒有就回傳 null */
export function firstRunReached(checkIns: CheckIn[], n: number): string | null {
  const sorted = [...checkIns].sort((a, b) => a.date.localeCompare(b.date))
  let run = 0
  let prev: string | null = null
  for (const c of sorted) {
    run = prev !== null && addDays(prev, 1) === c.date ? run + 1 : 1
    prev = c.date
    if (run === n) return c.reachedAt
  }
  return null
}
