// 今日一卦的流程：翻開時抽卦，翻面動畫播完才記 XP（規格 Stage 5 步驟 4）。

import { xp } from '../../storage/index.ts'

/** 翻開今日卦的 XP，每天一次（以日期為鍵，刪除當天紀錄後重抽也不會再給） */
export const awardDaily = (date: string, now = new Date()): Promise<xp.AwardResult> =>
  xp.award({ key: `daily:${date}`, source: 'daily', amount: xp.XP_AMOUNTS.daily, ref: date }, now)
