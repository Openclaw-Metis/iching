// 印譜 15 枚（規格「印譜」）：條件全部由既有資料判定，取得時間採實際達成的時間，
// 事件發生時與成就補發都呼叫同一個 checkSeals，所以重跑結果相同。

import { FLAGS } from '../../app/flags.ts'
import { STATIONS } from '../../data/stations.ts'
import { requireDb, seals as sealsRepo, type CheckIn, type ExamResult, type LessonProgress, type Mastery, type Reading, type Seal, type SealId, type XpEvent } from '../../storage/index.ts'
import { firstRunReached } from './streak.ts'

export interface SealInfo {
  id: SealId
  /** 印面的一個字 */
  char: string
  condition: string
}

const STATION_SEALS = ['qian', 'dui', 'li', 'zhen', 'xun', 'kan', 'gen', 'kun'] as const satisfies readonly SealId[]

export const SEALS: SealInfo[] = [
  { id: 'first', char: '初', condition: '完成任一課' },
  ...STATIONS.map((s, i): SealInfo => ({ id: STATION_SEALS[i], char: s.trigram, condition: `通過第${'一二三四五六七八'[i]}站（${s.theme}）考核` })),
  { id: 'seven', char: '七', condition: '連續 7 天達成每日目標' },
  { id: 'thirty', char: '卅', condition: '連續 30 天達成每日目標' },
  { id: 'all64', char: '全', condition: '64 卦都在看圖題答對過' },
  { id: 'review10', char: '溫', condition: '完成 10 輪溫故' },
  { id: 'yarrow', char: '筮', condition: '用大衍筮法完成一次占卜' },
  { id: 'journal10', char: '錄', condition: '10 則占卜紀錄寫了事後回顧' },
]

export const sealInfo = (id: SealId) => SEALS.find(s => s.id === id)!

/** 溫故關閉時不列出、不通知「溫」印；判定與保存照常，打開即恢復 */
export const isSealShown = (id: SealId) => FLAGS.review || id !== 'review10'

/** 印譜列出的印章 */
export const shownSeals = () => SEALS.filter(s => isSealShown(s.id))

export interface AchievementData {
  progress: LessonProgress[]
  exams: ExamResult[]
  checkIns: CheckIn[]
  mastery: Mastery[]
  xpEvents: XpEvent[]
  readings: Reading[]
}

const earliest = (times: (string | null | undefined)[]) => times.filter((t): t is string => Boolean(t)).sort()[0] ?? null
const nth = (times: string[], n: number) => (times.length >= n ? [...times].sort()[n - 1] : null)

/** 依資料算出已達成的印章與達成時間 */
export function evaluateSeals(d: AchievementData): Seal[] {
  const earned: Seal[] = []
  const add = (id: SealId, at: string | null) => { if (at) earned.push({ id, earnedAt: at }) }
  add('first', earliest(d.progress.filter(p => p.status === 'completed').map(p => p.completedAt)))
  STATIONS.forEach((s, i) => add(STATION_SEALS[i], earliest(d.exams.filter(e => e.passed && e.stationId === s.id).map(e => e.at))))
  add('seven', firstRunReached(d.checkIns, 7))
  add('thirty', firstRunReached(d.checkIns, 30))
  const images = d.mastery.filter(m => m.facet === 'image')
  if (new Set(images.map(m => m.hexagram)).size >= 64) add('all64', images.map(m => m.firstCorrectAt).sort().at(-1)!)
  add('review10', nth(d.xpEvents.filter(e => e.source === 'review').map(e => e.at), 10))
  const kept = d.readings.filter(r => !r.deletedAt)
  add('yarrow', earliest(kept.filter(r => r.method === 'yarrow-hand' || r.method === 'yarrow-quick').map(r => r.createdAt)))
  add('journal10', nth(kept.flatMap(r => (r.followUp ? [r.followUp.writtenAt] : [])), 10))
  return earned
}

/** 判定並寫入還沒有的印章，回傳這次新取得的 */
export async function checkSeals(): Promise<SealId[]> {
  const db = await requireDb()
  const [progress, exams, checkIns, mastery, xpEvents, readings] = await Promise.all([
    db.lessonProgress.toArray(), db.examResults.toArray(), db.checkIns.toArray(), db.mastery.toArray(), db.xpEvents.toArray(), db.readings.toArray(),
  ])
  return sealsRepo.grant(evaluateSeals({ progress, exams, checkIns, mastery, xpEvents, readings }))
}
