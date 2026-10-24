// 匯入前的驗證：外層、分卷資訊與逐筆資料。無效的筆數略過並計入預覽，不會整批失敗；
// 可以由其他欄位重算的值（占卜紀錄的本卦、之卦、變爻）以重算值為準並計入「已修正」。
// 所有物件都經 sanitize 重建：丟棄 __proto__、constructor、prototype 等鍵，巢狀超過 8 層即拒絕。

import { LESSON_IDS, parseLessonId } from '../../data/stations.ts'
import { hexagramsOf, isLineValue, type LineValue } from '../../lib/castLines.ts'
import { isDateKey } from '../../lib/dates.ts'
import { AppError } from '../../lib/errors.ts'
import {
  SCHEMA_VERSION, type Category, type CheckIn, type DailyDraw, type ExamResult, type ExportedTable, type Facet, type Favorite,
  type FsrsCardData, type LessonProgress, type Mastery, type Method, type Quote, type QuoteKind, type Reading, type ReviewCard,
  type ReviewLog, type Seal, type SealId, type Setting, type XpEvent, type XpSource, quotes, xp,
} from '../../storage/index.ts'
import { BACKUP_APP, BACKUP_FORMAT, type BackupFile, type BackupScope } from './format.ts'

export const MAX_FILE_BYTES = 50 * 1024 * 1024
export const MAX_DEPTH = 8
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

/** 深拷貝成只含 JSON 值的普通物件，丟棄危險鍵；超過深度上限時拋出 IMPORT_TOO_LARGE */
export function sanitize(value: unknown, depth = 1): Json {
  if (depth > MAX_DEPTH) throw new AppError('IMPORT_TOO_LARGE', '備份檔的巢狀層數超過上限。')
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) return value.map(v => sanitize(v, depth + 1))
  if (typeof value === 'object') {
    const out: { [key: string]: Json } = {}
    for (const [k, v] of Object.entries(value)) if (!UNSAFE_KEYS.has(k)) out[k] = sanitize(v, depth + 1)
    return out
  }
  return null
}

/** 讀入檔案文字：大小、JSON 格式與巢狀深度 */
export function parseBackupText(text: string): Json {
  if (new Blob([text]).size > MAX_FILE_BYTES) throw new AppError('IMPORT_TOO_LARGE')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    throw new AppError('IMPORT_INVALID_FILE', undefined, { cause: e })
  }
  return sanitize(raw)
}

const isObject = (v: unknown): v is { [key: string]: Json } => typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (v: unknown, min = -Infinity, max = Infinity): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max
const isoDate = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}
const len = (s: string) => [...s].length

export interface BackupEnvelope extends Omit<BackupFile, 'data'> {
  data: { [table: string]: Json }
}

/** 外層：是不是本站的備份檔、版本是否較新、分卷資訊是否合法 */
export function validateEnvelope(raw: Json): BackupEnvelope {
  if (!isObject(raw) || raw.app !== BACKUP_APP) throw new AppError('IMPORT_INVALID_FILE')
  const { format, schema, scope, set, exportedAt, data } = raw
  if (!isInt(format, 1) || !isInt(schema, 1)) throw new AppError('IMPORT_INVALID_FILE')
  if (format > BACKUP_FORMAT || schema > SCHEMA_VERSION) throw new AppError('IMPORT_NEWER_FORMAT')
  if (scope !== 'full' && scope !== 'partial') throw new AppError('IMPORT_INVALID_FILE')
  if (!isObject(set) || typeof set.id !== 'string' || !set.id || !isInt(set.total, 1) || !isInt(set.index, 1, set.total as number)) {
    throw new AppError('IMPORT_INVALID_FILE')
  }
  const exported = isoDate(exportedAt)
  if (!exported || !isObject(data)) throw new AppError('IMPORT_INVALID_FILE')
  return {
    app: BACKUP_APP, format, schema, scope: scope as BackupScope, exportedAt: exported,
    set: { id: set.id, index: set.index as number, total: set.total as number }, data,
  }
}

/** 逐筆驗證的結果：value 為 null 代表無效、略過；corrected 代表有欄位以重算值取代 */
export interface RecordCheck<T> {
  value: T | null
  corrected: boolean
}

const CATEGORIES: Category[] = ['career', 'relations', 'decision', 'general']
const METHODS: Method[] = ['coins', 'yarrow-hand', 'yarrow-quick', 'manual']
const invalid = { value: null, corrected: false } as const

export function validateReading(raw: Json): RecordCheck<Reading> {
  if (!isObject(raw)) return invalid
  const { id, createdAt, updatedAt, rev, question, category, method, lines, primary, result, moving, note, followUp, starred, v, deletedAt } = raw
  if (typeof id !== 'string' || !id || len(id) > 100) return invalid
  const created = isoDate(createdAt), updated = isoDate(updatedAt)
  if (!created || !updated) return invalid
  if (typeof question !== 'string' || len(question.trim()) < 2 || len(question.trim()) > 200) return invalid
  if (!CATEGORIES.includes(category as Category) || !METHODS.includes(method as Method)) return invalid
  if (!Array.isArray(lines) || lines.length !== 6 || !lines.every(isLineValue)) return invalid
  if (typeof note !== 'string' || len(note) > 2000) return invalid

  let follow: Reading['followUp'] = null
  if (followUp !== null && followUp !== undefined) {
    const writtenAt = isObject(followUp) ? isoDate(followUp.writtenAt) : null
    if (!isObject(followUp) || typeof followUp.text !== 'string' || len(followUp.text) > 2000 || !writtenAt) return invalid
    follow = { text: followUp.text, writtenAt }
  }
  let star: 0 | 1
  if (starred === true || starred === 1) star = 1
  else if (starred === false || starred === 0) star = 0
  else return invalid
  let deleted: string | null = null
  if (deletedAt !== null && deletedAt !== undefined) {
    deleted = isoDate(deletedAt)
    if (!deleted) return invalid
  }

  const computed = hexagramsOf(lines as LineValue[])
  const corrected = primary !== computed.primary.number || result !== computed.result.number
    || !Array.isArray(moving) || moving.length !== computed.moving.length || moving.some((m, i) => m !== computed.moving[i])

  return {
    corrected,
    value: {
      id, createdAt: created, updatedAt: updated, rev: isInt(rev, 1) ? rev : 1,
      question: question.trim(), category: category as Category, method: method as Method,
      lines: [...lines] as LineValue[], primary: computed.primary.number, result: computed.result.number, moving: computed.moving,
      note, followUp: follow, starred: star, v: isInt(v, 1) ? v : 1, deletedAt: deleted,
    },
  }
}

const isHexagram = (v: unknown): v is number => isInt(v, 1, 64)
const isStr = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && len(v) <= max
const FACETS: Facet[] = ['glyph', 'image']
const ok = <T>(value: T, corrected = false): RecordCheck<T> => ({ value, corrected })

export function validateDailyDraw(raw: Json): RecordCheck<DailyDraw> {
  if (!isObject(raw)) return invalid
  const { date, hexagram, drawnAt, note, updatedAt, rev } = raw
  const drawn = isoDate(drawnAt), updated = isoDate(updatedAt)
  if (!isDateKey(date) || !isHexagram(hexagram) || !drawn || !updated || typeof note !== 'string' || len(note) > 500) return invalid
  return ok({ date, hexagram, drawnAt: drawn, note, updatedAt: updated, rev: isInt(rev, 1) ? rev : 1 })
}

export function validateFavorite(raw: Json): RecordCheck<Favorite> {
  if (!isObject(raw)) return invalid
  const added = isoDate(raw.addedAt)
  if (!isHexagram(raw.hexagram) || !added) return invalid
  return ok({ hexagram: raw.hexagram, addedAt: added })
}

const QUOTE_KINDS: QuoteKind[] = ['judgment', 'daxiang', 'line', 'useAll']

// 金句 id 的規則與收藏時共用（storage/repos/quotes.ts）：只有 line 帶 0 到 5 的爻位，useAll 只限乾坤
export const quoteId = quotes.quoteId

export function validateQuote(raw: Json): RecordCheck<Quote> {
  if (!isObject(raw)) return invalid
  const { id, hexagram, kind, position } = raw
  const added = isoDate(raw.addedAt)
  if (!isHexagram(hexagram) || !QUOTE_KINDS.includes(kind as QuoteKind) || !added) return invalid
  if (kind === 'line' ? !isInt(position, 0, 5) : position !== undefined && position !== null) return invalid
  if (kind === 'useAll' && hexagram > 2) return invalid
  if (id !== quoteId(hexagram, kind as QuoteKind, position as number)) return invalid
  return ok({ id, hexagram, kind: kind as QuoteKind, ...(kind === 'line' ? { position: position as number } : {}), addedAt: added })
}

const PROGRESS = ['available', 'in-progress', 'completed'] as const

export function validateLessonProgress(raw: Json): RecordCheck<LessonProgress> {
  if (!isObject(raw)) return invalid
  const { lessonId, stationId, status, step, correct, total, completedAt } = raw
  const lesson = typeof lessonId === 'string' ? parseLessonId(lessonId) : null
  const updated = isoDate(raw.updatedAt)
  if (!lesson || !LESSON_IDS.includes(lessonId as string) || stationId !== lesson.station.id) return invalid
  if (!PROGRESS.includes(status as (typeof PROGRESS)[number]) || !isInt(step, 0) || !isInt(correct, 0) || !isInt(total, 0) || !updated) return invalid
  const completed = completedAt === null || completedAt === undefined ? null : isoDate(completedAt)
  if (completedAt !== null && completedAt !== undefined && !completed) return invalid
  return ok({ lessonId: lessonId as string, stationId: lesson.station.id, status: status as LessonProgress['status'], step, correct, total, completedAt: completed, updatedAt: updated })
}

export function validateExamResult(raw: Json): RecordCheck<ExamResult> {
  if (!isObject(raw)) return invalid
  const { id, attemptId, stationId, score, passed } = raw
  const at = isoDate(raw.at)
  if (!isStr(id, 100) || !isStr(attemptId, 100) || !isInt(stationId, 1, 8) || !isInt(score, 0, 10) || typeof passed !== 'boolean' || !at) return invalid
  return ok({ id, attemptId, stationId, score, passed, at })
}

const nonNegative = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

function validateFsrs(raw: Json): FsrsCardData | null {
  if (!isObject(raw)) return null
  const { stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state } = raw
  const due = isoDate(raw.due)
  if (!due || !isInt(state, 0, 3) || !nonNegative(stability) || !nonNegative(difficulty)) return null
  if (state === 0 ? stability !== 0 || difficulty !== 0 : difficulty < 1 || difficulty > 10) return null
  if (!isInt(reps, 0) || !isInt(lapses, 0) || !isInt(learning_steps, 0) || !nonNegative(elapsed_days) || !nonNegative(scheduled_days)) return null
  let lastReview: string | undefined
  if (raw.last_review !== undefined && raw.last_review !== null) {
    lastReview = isoDate(raw.last_review) ?? undefined
    if (!lastReview || lastReview > due) return null
  }
  return { due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state: state as FsrsCardData['state'], ...(lastReview ? { last_review: lastReview } : {}) }
}

export function validateReviewCard(raw: Json): RecordCheck<ReviewCard> {
  if (!isObject(raw)) return invalid
  const { id, hexagram, facet } = raw
  const fsrs = validateFsrs(raw.fsrs)
  const added = isoDate(raw.addedAt), updated = isoDate(raw.updatedAt)
  if (!isHexagram(hexagram) || !FACETS.includes(facet as Facet) || id !== `${hexagram}:${facet}` || !fsrs || !added || !updated) return invalid
  let removed: string | null = null
  if (raw.removedAt !== null && raw.removedAt !== undefined) {
    removed = isoDate(raw.removedAt)
    if (!removed) return invalid
  }
  // 索引欄位 due 一律由 fsrs.due 重建
  return ok({ id, hexagram, facet: facet as Facet, fsrs, due: fsrs.due, addedAt: added, updatedAt: updated, removedAt: removed }, raw.due !== fsrs.due)
}

export function validateReviewLog(raw: Json): RecordCheck<ReviewLog> {
  if (!isObject(raw)) return invalid
  const { id, cardId, sessionId, rating, elapsedMs } = raw
  const reviewed = isoDate(raw.reviewedAt)
  if (!isStr(id, 100) || typeof cardId !== 'string' || !/^([1-9]|[1-5]\d|6[0-4]):(glyph|image)$/.test(cardId)) return invalid
  if (!isStr(sessionId, 100) || !isInt(rating, 1, 4) || !reviewed || !nonNegative(elapsedMs)) return invalid
  return ok({ id, cardId, sessionId, rating: rating as ReviewLog['rating'], reviewedAt: reviewed, elapsedMs })
}

export function validateMastery(raw: Json): RecordCheck<Mastery> {
  if (!isObject(raw)) return invalid
  const { id, hexagram, facet } = raw
  const first = isoDate(raw.firstCorrectAt)
  if (!isHexagram(hexagram) || !FACETS.includes(facet as Facet) || id !== `${hexagram}:${facet}` || !first) return invalid
  return ok({ id, hexagram, facet: facet as Facet, firstCorrectAt: first })
}

/** 各來源的 XP 與業務鍵格式（規格「學堂內容設計：XP 與每日目標」） */
export const XP_RULES: Record<XpSource, { amount: number; key: RegExp }> = {
  answer: { amount: xp.XP_AMOUNTS.answer, key: /^answer:[^:]+:\d+$/ },
  lesson: { amount: xp.XP_AMOUNTS.lesson, key: /^lesson:S[1-8]-L[1-3]$/ },
  exam: { amount: xp.XP_AMOUNTS.exam, key: /^exam:[1-8]$/ },
  review: { amount: xp.XP_AMOUNTS.review, key: /^review:[^:]+$/ },
  daily: { amount: xp.XP_AMOUNTS.daily, key: /^daily:\d{4}-\d{2}-\d{2}$/ },
  divine: { amount: xp.XP_AMOUNTS.divine, key: /^divine:\d{4}-\d{2}-\d{2}$/ },
}

export function validateXpEvent(raw: Json): RecordCheck<XpEvent> {
  if (!isObject(raw)) return invalid
  const { id, key, date, amount, source, ref } = raw
  const at = isoDate(raw.at)
  const rule = typeof source === 'string' ? XP_RULES[source as XpSource] : undefined
  if (!isStr(id, 100) || typeof key !== 'string' || !rule || !rule.key.test(key) || amount !== rule.amount || !at || !isDateKey(date)) return invalid
  if ((source === 'daily' || source === 'divine') && !isDateKey(key.split(':')[1])) return invalid
  return ok({ id, key, at, date, amount, source: source as XpSource, ref: typeof ref === 'string' ? ref : '' })
}

const GOALS = [20, 30, 50]

export function validateCheckIn(raw: Json): RecordCheck<CheckIn> {
  if (!isObject(raw)) return invalid
  const reached = isoDate(raw.reachedAt)
  if (!isDateKey(raw.date) || !GOALS.includes(raw.goal as number) || !reached) return invalid
  return ok({ date: raw.date, goal: raw.goal as number, reachedAt: reached })
}

export const SEAL_IDS: SealId[] = ['first', 'qian', 'dui', 'li', 'zhen', 'xun', 'kan', 'gen', 'kun', 'seven', 'thirty', 'all64', 'review10', 'yarrow', 'journal10']

export function validateSeal(raw: Json): RecordCheck<Seal> {
  if (!isObject(raw)) return invalid
  const earned = isoDate(raw.earnedAt)
  if (!SEAL_IDS.includes(raw.id as SealId) || !earned) return invalid
  return ok({ id: raw.id as SealId, earnedAt: earned })
}

/** 只接受會匯出的兩個設定鍵 */
export function validateSetting(raw: Json): RecordCheck<Setting> {
  if (!isObject(raw)) return invalid
  const { key, value } = raw
  const updated = isoDate(raw.updatedAt)
  if (!updated) return invalid
  if (key === 'dailyGoal' && GOALS.includes(value as number)) return ok({ key, value, updatedAt: updated })
  if (key === 'reminderTime' && typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return ok({ key, value, updatedAt: updated })
  return invalid
}

/** 各資料表的逐筆驗證 */
export const RECORD_VALIDATORS: Record<ExportedTable, (raw: Json) => RecordCheck<unknown>> = {
  readings: validateReading,
  dailyDraws: validateDailyDraw,
  favorites: validateFavorite,
  quotes: validateQuote,
  lessonProgress: validateLessonProgress,
  examResults: validateExamResult,
  reviewCards: validateReviewCard,
  reviewLogs: validateReviewLog,
  mastery: validateMastery,
  xpEvents: validateXpEvent,
  checkIns: validateCheckIn,
  seals: validateSeal,
  settings: validateSetting,
}

export interface TableCheck {
  valid: unknown[]
  corrected: number
  invalid: number
}

export function validateTables(data: BackupEnvelope['data']): Record<ExportedTable, TableCheck> {
  const out = {} as Record<ExportedTable, TableCheck>
  for (const [table, validator] of Object.entries(RECORD_VALIDATORS) as [ExportedTable, (raw: Json) => RecordCheck<unknown>][]) {
    const rows = data[table]
    const check: TableCheck = { valid: [], corrected: 0, invalid: 0 }
    if (rows !== undefined && !Array.isArray(rows)) check.invalid++
    for (const row of Array.isArray(rows) ? rows : []) {
      const r = validator(row)
      if (r.value === null) check.invalid++
      else {
        check.valid.push(r.value)
        if (r.corrected) check.corrected++
      }
    }
    out[table] = check
  }
  return out
}
