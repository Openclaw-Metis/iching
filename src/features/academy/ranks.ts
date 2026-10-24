// 修為等級：起始為學徒，每通過一站考核晉升一階（識爻、識卦……知占）。

import { FIRST_RANK, STATIONS } from '../../data/stations.ts'

export const RANKS = [FIRST_RANK, ...STATIONS.map(s => s.rank)]

/** 依通過的最高一站決定；一站都沒過是學徒 */
export const rankOf = (highestPassed: number): string => RANKS[Math.max(0, Math.min(highestPassed, STATIONS.length))]
