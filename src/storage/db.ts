// 本機資料庫 `iching` 的資料表與版本。全部使用者資料都在這裡，只有 src/storage 能直接碰 IndexedDB。
//
// 建表原則（規格「核心資料模型」）：
// - 會跨裝置合併的資料，主鍵用 UUID 或業務鍵，不用自動編號，兩台裝置的編號才不會相撞。
// - IndexedDB 不能拿布林與 null 當索引鍵：星號存 0 或 1；deletedAt、removedAt、passed 這類欄位不建索引，查詢後在記憶體過濾。
//
// 升級策略：資料表版本只升不降。之後任何欄位或資料表變動都以 db.version(n + 1) 宣告並寫 upgrade 函式，
// 舊資料逐筆轉換、不刪除使用者資料，最後把 meta 的 schema 改成新版號；每一版的升級都要在 db.test.ts 留測試。
// 新增資料表時，同步更新 EXPORTED_TABLES、備份格式、匯入驗證與合併規則。

import { Dexie, type DexieOptions, type EntityTable } from 'dexie'

export const DB_NAME = 'iching'
export const SCHEMA_VERSION = 1

// ── 占卜 ─────────────────────────────────────────────

export type Category = 'career' | 'relations' | 'decision' | 'general'
/** 起卦方法；'draw' 保留給之後討論的抽牌占卜，目前不寫入 */
export type Method = 'coins' | 'yarrow-hand' | 'yarrow-quick' | 'manual'
export type DraftMethod = 'coins' | 'yarrow' | 'manual'
export type YarrowMode = 'hand' | 'quick'
/** 爻值：6 老陰、7 少陽、8 少陰、9 老陽 */
export type LineValue = 6 | 7 | 8 | 9

export interface Reading {
  /** 等於起卦草稿的 castId（UUID） */
  id: string
  createdAt: string
  updatedAt: string
  /** 建立時為 1，每次寫入加一；跨分頁寫入在交易內比對 */
  rev: number
  question: string
  category: Category
  method: Method
  /** 6 個爻值，初爻在前 */
  lines: LineValue[]
  /** 本卦卦序 */
  primary: number
  /** 之卦卦序（沒有變爻時等於本卦） */
  result: number
  /** 變爻位置 0 到 5 */
  moving: number[]
  note: string
  followUp: { text: string; writtenAt: string } | null
  starred: 0 | 1
  /** 紀錄格式版本 */
  v: number
  deletedAt: string | null
}

export interface CastDraft {
  key: 'current'
  castId: string
  phase: 'question' | 'casting' | 'complete'
  rev: number
  question: string
  category: Category
  method: DraftMethod
  yarrowMode: YarrowMode
  lines: LineValue[]
  /** 親手分蓍進行中的變：第幾爻、第幾變、本變開始時的根數 */
  yarrow: { line: number; change: number; remaining: number } | null
  startedAt: string
  updatedAt: string
}

// ── 每日一卦與收藏 ───────────────────────────────────

export interface DailyDraw {
  /** 本地日期 YYYY-MM-DD */
  date: string
  hexagram: number
  drawnAt: string
  note: string
  updatedAt: string
  rev: number
}

export interface Favorite {
  hexagram: number
  addedAt: string
}

export type QuoteKind = 'judgment' | 'daxiang' | 'line' | 'useAll'

export interface Quote {
  /** 卦序:種類[:爻位]，如 1:line:5、29:daxiang、2:useAll */
  id: string
  hexagram: number
  kind: QuoteKind
  /** 只有 line 帶 0 到 5 */
  position?: number
  addedAt: string
}

// ── 學堂 ─────────────────────────────────────────────

export type Facet = 'glyph' | 'image'

export interface LessonProgress {
  /** 課號，如 S2-L1 */
  lessonId: string
  stationId: number
  status: 'available' | 'in-progress' | 'completed'
  step: number
  correct: number
  total: number
  completedAt: string | null
  updatedAt: string
}

/** 題目快照：作答進度存下完整題目，出題器日後更新也不影響進行中的作答 */
export interface QuestionSnapshot {
  questionKey: string
  type: string
  prompt: { text: string; [extra: string]: unknown }
  options: { label: string; [extra: string]: unknown }[]
  answerIndex: number
  explanation: string
  hexagram?: number
  facet?: Facet
}

export interface AnswerRecord {
  choice: number
  checked: boolean
  correct: boolean
  elapsedMs: number
}

export interface Attempt {
  id: string
  kind: 'lesson' | 'exam'
  /** 課號或站號 */
  target: string
  /** 開始時的本地日期 */
  date: string
  questions: QuestionSnapshot[]
  answers: (AnswerRecord | null)[]
  position: number
  status: 'active' | 'done' | 'void'
  startedAt: string
  updatedAt: string
}

export interface ExamResult {
  id: string
  attemptId: string
  stationId: number
  score: number
  passed: boolean
  at: string
}

/** ts-fsrs 5.x 的 Card 欄位，日期存 ISO 字串（state：0 New、1 Learning、2 Review、3 Relearning） */
export interface FsrsCardData {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: 0 | 1 | 2 | 3
  last_review?: string
}

export interface ReviewCard {
  /** 卦序:glyph 或 卦序:image */
  id: string
  hexagram: number
  facet: Facet
  fsrs: FsrsCardData
  /** 索引用，一律由 fsrs.due 重建 */
  due: string
  addedAt: string
  /** 加入、作答、移出、恢復時更新 */
  updatedAt: string
  removedAt: string | null
}

export interface ReviewLog {
  id: string
  cardId: string
  sessionId: string
  rating: 1 | 2 | 3 | 4
  reviewedAt: string
  elapsedMs: number
}

export interface Mastery {
  /** 卦序:glyph 或 卦序:image */
  id: string
  hexagram: number
  facet: Facet
  firstCorrectAt: string
}

export type XpSource = 'answer' | 'lesson' | 'exam' | 'review' | 'daily' | 'divine'

export interface XpEvent {
  id: string
  /** 唯一的業務鍵，如 lesson:S1-L1、daily:2026-10-24 */
  key: string
  at: string
  date: string
  amount: number
  source: XpSource
  ref: string
}

export interface CheckIn {
  date: string
  /** 達標當時的每日目標 */
  goal: number
  reachedAt: string
}

export type SealId =
  | 'first' | 'qian' | 'dui' | 'li' | 'zhen' | 'xun' | 'kan' | 'gen' | 'kun'
  | 'seven' | 'thirty' | 'all64' | 'review10' | 'yarrow' | 'journal10'

export interface Seal {
  id: SealId
  earnedAt: string
}

// ── 設定與中繼資料 ───────────────────────────────────

export interface Setting {
  key: string
  value: unknown
  updatedAt: string
}

export interface Meta {
  key: 'install'
  schema: number
  installId: string
  createdAt: string
}

export type IchingDB = Dexie & {
  readings: EntityTable<Reading, 'id'>
  castDraft: EntityTable<CastDraft, 'key'>
  dailyDraws: EntityTable<DailyDraw, 'date'>
  favorites: EntityTable<Favorite, 'hexagram'>
  quotes: EntityTable<Quote, 'id'>
  lessonProgress: EntityTable<LessonProgress, 'lessonId'>
  attempts: EntityTable<Attempt, 'id'>
  examResults: EntityTable<ExamResult, 'id'>
  reviewCards: EntityTable<ReviewCard, 'id'>
  reviewLogs: EntityTable<ReviewLog, 'id'>
  mastery: EntityTable<Mastery, 'id'>
  xpEvents: EntityTable<XpEvent, 'id'>
  checkIns: EntityTable<CheckIn, 'date'>
  seals: EntityTable<Seal, 'id'>
  settings: EntityTable<Setting, 'key'>
  meta: EntityTable<Meta, 'key'>
}

const STORES_V1 = {
  readings: 'id, [createdAt+id], primary, starred',
  castDraft: 'key',
  dailyDraws: 'date',
  favorites: 'hexagram, addedAt',
  quotes: 'id, hexagram, addedAt',
  lessonProgress: 'lessonId, stationId, status',
  attempts: 'id, [kind+target], status',
  examResults: 'id, stationId, at',
  reviewCards: 'id, hexagram, due',
  reviewLogs: 'id, cardId, reviewedAt',
  mastery: 'id, hexagram, facet',
  xpEvents: 'id, &key, date, source',
  checkIns: 'date',
  seals: 'id',
  settings: 'key',
  meta: 'key',
} as const

export type TableName = keyof typeof STORES_V1
export const TABLE_NAMES = Object.keys(STORES_V1) as TableName[]

/** 會進備份檔的資料表；castDraft、attempts、meta 不匯出 */
export const EXPORTED_TABLES = [
  'readings', 'dailyDraws', 'favorites', 'quotes', 'lessonProgress', 'examResults',
  'reviewCards', 'reviewLogs', 'mastery', 'xpEvents', 'checkIns', 'seals', 'settings',
] as const satisfies readonly TableName[]
export type ExportedTable = (typeof EXPORTED_TABLES)[number]

/** 會匯出的使用者偏好；其餘設定鍵只屬於這台裝置 */
export const EXPORTED_SETTING_KEYS = ['dailyGoal', 'reminderTime'] as const
export const DEVICE_SETTING_KEYS = ['lastBackupAt', 'lastCleanup', 'persistAsked', 'backupSnoozeUntil', 'onboardingSeen'] as const

/** IndexedDB 的原生版本號：Dexie 會把 db.version(n) 乘以 10 */
export const nativeVersion = (schema: number) => schema * 10

export function createDb(options?: DexieOptions): IchingDB {
  const db = new Dexie(DB_NAME, options) as IchingDB
  db.version(1).stores(STORES_V1)
  // 第一次建立資料庫時寫入中繼資料；之後的版本在各自的 upgrade 函式裡更新 schema
  db.on('populate', tx => {
    tx.table('meta').add({ key: 'install', schema: SCHEMA_VERSION, installId: crypto.randomUUID(), createdAt: new Date().toISOString() } satisfies Meta)
  })
  return db
}
