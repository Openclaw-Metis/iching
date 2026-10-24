// XP 事件與打卡（規格「學堂內容設計」的 XP 與每日目標）。
// 每筆 XP 有唯一的業務鍵，寫入時在同一個交易內檢查鍵、作答上限與溫故輪數，兩個分頁同時寫也不會重複給。
// 統計時每天的作答 XP 一律以 100 封頂：合併另一台裝置的備份後，單日作答事件即使超過上限，結果仍一致。

import { addDays, localDateKey } from '../../lib/dates.ts'
import { AppError, isQuotaError } from '../../lib/errors.ts'
import { requireDb } from '../connection.ts'
import type { CheckIn, IchingDB, XpEvent, XpSource } from '../db.ts'
import { SETTING_DEFAULTS, type SettingValues } from './settings.ts'

/** 各事件的 XP（規格「XP 與每日目標」表）；備份驗證也以這裡為準 */
export const XP_AMOUNTS = { answer: 2, lesson: 10, exam: 30, review: 10, daily: 5, divine: 5 } as const satisfies Record<XpSource, number>

export const ANSWER_DAILY_CAP = 100
/** 同一題（作答事件的 ref 是 questionKey）10 秒內重複作答不給 XP */
export const ANSWER_COOLDOWN_MS = 10_000
export const REVIEW_DAILY_ROUNDS = 3

export interface AwardInput {
  key: string
  source: XpSource
  amount: number
  ref?: string
}

export interface AwardResult {
  awarded: number
  /** 因每日上限（作答 100 XP、溫故 3 輪）沒有給 */
  capped: boolean
}

export interface XpSummary {
  today: number
  total: number
  goal: number
  /** 連續達標天數：今天未達標時從昨天往前數 */
  streak: number
  best: number
}

/** 每天的 XP：作答部分以 100 封頂，其餘照加 */
export function dayTotals(events: Pick<XpEvent, 'date' | 'amount' | 'source'>[]): Map<string, number> {
  const answers = new Map<string, number>()
  const others = new Map<string, number>()
  for (const e of events) {
    const bucket = e.source === 'answer' ? answers : others
    bucket.set(e.date, (bucket.get(e.date) ?? 0) + e.amount)
  }
  const totals = new Map<string, number>()
  for (const [date, n] of answers) totals.set(date, Math.min(ANSWER_DAILY_CAP, n))
  for (const [date, n] of others) totals.set(date, (totals.get(date) ?? 0) + n)
  return totals
}

/** 由打卡日期算連續天數；dates 不必排序 */
export function streaks(dates: string[], today: string): { streak: number; best: number } {
  const set = new Set(dates)
  let streak = 0
  for (let d = set.has(today) ? today : addDays(today, -1); set.has(d); d = addDays(d, -1)) streak++
  let best = 0
  for (const d of set) {
    // 只從每一段的第一天往後數，整體是線性時間
    if (set.has(addDays(d, -1))) continue
    let run = 0
    for (let x = d; set.has(x); x = addDays(x, 1)) run++
    best = Math.max(best, run)
  }
  return { streak, best }
}

async function goalIn(db: IchingDB): Promise<number> {
  const row = await db.settings.get('dailyGoal')
  return (row?.value as SettingValues['dailyGoal'] | undefined) ?? SETTING_DEFAULTS.dailyGoal
}

/** 當天 XP 第一次達到當時的每日目標時寫入打卡；要在含 xpEvents、checkIns、settings 的交易內呼叫 */
async function checkInWithin(db: IchingDB, date: string, at: string): Promise<CheckIn | undefined> {
  if (await db.checkIns.get(date)) return undefined
  const goal = await goalIn(db)
  const events = await db.xpEvents.where('date').equals(date).toArray()
  if ((dayTotals(events).get(date) ?? 0) < goal) return undefined
  const row: CheckIn = { date, goal, reachedAt: at }
  await db.checkIns.add(row)
  return row
}

const rethrow = (e: unknown): never => {
  if (isQuotaError(e)) throw new AppError('STORAGE_QUOTA', undefined, { cause: e })
  throw e
}

export async function award(input: AwardInput, now = new Date()): Promise<AwardResult> {
  const db = await requireDb()
  const date = localDateKey(now)
  const at = now.toISOString()
  return db.transaction('rw', db.xpEvents, db.checkIns, db.settings, async () => {
    if (await db.xpEvents.where('key').equals(input.key).count()) return { awarded: 0, capped: false }
    const sameDay = await db.xpEvents.where('date').equals(date).toArray()
    const sum = (source: XpSource) => sameDay.filter(e => e.source === source).reduce((n, e) => n + e.amount, 0)
    if (input.source === 'answer' && sum('answer') >= ANSWER_DAILY_CAP) return { awarded: 0, capped: true }
    if (input.source === 'answer' && input.ref && sameDay.some(e => e.source === 'answer' && e.ref === input.ref && now.getTime() - Date.parse(e.at) < ANSWER_COOLDOWN_MS)) {
      return { awarded: 0, capped: false }
    }
    if (input.source === 'review' && sameDay.filter(e => e.source === 'review').length >= REVIEW_DAILY_ROUNDS) return { awarded: 0, capped: true }
    await db.xpEvents.add({ id: crypto.randomUUID(), key: input.key, at, date, amount: input.amount, source: input.source, ref: input.ref ?? '' })
    await checkInWithin(db, date, at)
    return { awarded: input.amount, capped: false }
  }).catch(rethrow)
}

/** 改了每日目標或啟動時補做今天的打卡檢查（例如目標調低後今天其實已達標） */
export async function ensureCheckIn(now = new Date()): Promise<CheckIn | undefined> {
  const db = await requireDb()
  return db.transaction('rw', db.xpEvents, db.checkIns, db.settings, () => checkInWithin(db, localDateKey(now), now.toISOString()))
}

export async function summary(now = new Date()): Promise<XpSummary> {
  const db = await requireDb()
  return summaryOf(db, now)
}

/** 給 useLiveQuery 直接用：查詢函式裡只能 await Dexie 的 promise */
export async function summaryOf(db: IchingDB, now = new Date()): Promise<XpSummary> {
  const today = localDateKey(now)
  const [events, checkIns, goal] = await Promise.all([db.xpEvents.toArray(), db.checkIns.toArray(), goalIn(db)])
  const totals = dayTotals(events)
  let total = 0
  for (const n of totals.values()) total += n
  return { today: totals.get(today) ?? 0, total, goal, ...streaks(checkIns.map(c => c.date), today) }
}
