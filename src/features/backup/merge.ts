// 合併規則（規格「核心資料模型：合併規則」）：主鍵相同時保留哪一筆。
// 回傳要寫入的那一筆，保留本機的就回傳 null。

import type { CheckIn, DailyDraw, ExportedTable, Favorite, LessonProgress, Mastery, Quote, Reading, ReviewCard, Seal, Setting, XpEvent } from '../../storage/index.ts'

/** 每張表在合併時用來比對的鍵；xpEvents 以業務鍵 key 去重 */
export const MERGE_KEY: Record<ExportedTable, string> = {
  readings: 'id', dailyDraws: 'date', favorites: 'hexagram', quotes: 'id', lessonProgress: 'lessonId', examResults: 'id',
  reviewCards: 'id', reviewLogs: 'id', mastery: 'id', xpEvents: 'key', checkIns: 'date', seals: 'id', settings: 'key',
}

export const keyOf = (table: ExportedTable, row: unknown) => (row as Record<string, string | number>)[MERGE_KEY[table]]

const STATUS_RANK: Record<LessonProgress['status'], number> = { available: 0, 'in-progress': 1, completed: 2 }

export function mergeRow(table: ExportedTable, incoming: unknown, local: unknown | undefined): unknown | null {
  if (local === undefined) {
    // 新的占卜紀錄與今日卦不採用檔案中的 rev，從 1 開始
    if (table === 'readings' || table === 'dailyDraws') return { ...(incoming as Reading | DailyDraw), rev: 1 }
    return incoming
  }
  switch (table) {
    case 'readings':
    case 'dailyDraws': {
      const a = incoming as Reading | DailyDraw, b = local as Reading | DailyDraw
      return a.updatedAt > b.updatedAt ? { ...a, rev: b.rev + 1 } : null
    }
    case 'reviewCards':
    case 'settings':
      return (incoming as ReviewCard | Setting).updatedAt > (local as ReviewCard | Setting).updatedAt ? incoming : null
    case 'lessonProgress': {
      const a = incoming as LessonProgress, b = local as LessonProgress
      const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status]
      if (rank !== 0) return rank > 0 ? a : null
      if (a.step !== b.step) return a.step > b.step ? a : null
      return a.updatedAt > b.updatedAt ? a : null
    }
    case 'xpEvents':
      return (incoming as XpEvent).at < (local as XpEvent).at ? incoming : null
    case 'mastery':
      return (incoming as Mastery).firstCorrectAt < (local as Mastery).firstCorrectAt ? incoming : null
    case 'checkIns':
      return (incoming as CheckIn).reachedAt < (local as CheckIn).reachedAt ? incoming : null
    case 'seals':
      return (incoming as Seal).earnedAt < (local as Seal).earnedAt ? incoming : null
    case 'favorites':
    case 'quotes':
      return (incoming as Favorite | Quote).addedAt < (local as Favorite | Quote).addedAt ? incoming : null
    case 'examResults':
    case 'reviewLogs':
      return null
  }
}
