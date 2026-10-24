// 占卜紀錄。六爻完成時以草稿的 castId 為主鍵建立，同一個交易刪除草稿，中斷後重來也不會出現第二筆。
// 會被多個分頁修改，所以修改一律在同一個 readwrite 交易內比對 rev。

import { hexagramsOf } from '../../lib/castLines.ts'
import { AppError, isQuotaError } from '../../lib/errors.ts'
import { requireDb } from '../connection.ts'
import type { CastDraft, Category, IchingDB, Method, Reading } from '../db.ts'

export const READING_FORMAT = 1
export const QUESTION_MIN = 2
export const QUESTION_MAX = 200
export const NOTE_MAX = 2000

const len = (s: string) => [...s].length

export function methodOf(draft: Pick<CastDraft, 'method' | 'yarrowMode'>): Method {
  if (draft.method === 'yarrow') return draft.yarrowMode === 'hand' ? 'yarrow-hand' : 'yarrow-quick'
  return draft.method
}

/** 由完成的草稿組出紀錄（保存失敗時下載單筆結果也用同一份） */
export function readingFromDraft(draft: CastDraft, now = new Date()): Reading {
  if (draft.lines.length !== 6) throw new RangeError(`草稿只有 ${draft.lines.length} 爻`)
  const { primary, result, moving } = hexagramsOf(draft.lines)
  const at = now.toISOString()
  return {
    id: draft.castId,
    createdAt: at,
    updatedAt: at,
    rev: 1,
    question: draft.question.trim(),
    category: draft.category,
    method: methodOf(draft),
    lines: [...draft.lines],
    primary: primary.number,
    result: result.number,
    moving,
    note: '',
    followUp: null,
    starred: 0,
    v: READING_FORMAT,
    deletedAt: null,
  }
}

const rethrow = (e: unknown): never => {
  if (isQuotaError(e)) throw new AppError('STORAGE_QUOTA', undefined, { cause: e })
  throw e
}

/** 建立紀錄並刪除草稿；同 id 已存在時回傳既有那一筆（同樣刪除草稿） */
export async function completeCast(draft: CastDraft, now = new Date()): Promise<Reading> {
  const db = await requireDb()
  const fresh = readingFromDraft(draft, now)
  return db.transaction('rw', db.readings, db.castDraft, async () => {
    const existing = await db.readings.get(draft.castId)
    if (!existing) await db.readings.add(fresh)
    const current = await db.castDraft.get('current')
    if (current?.castId === draft.castId) await db.castDraft.delete('current')
    return existing ?? fresh
  }).catch(rethrow)
}

export async function get(id: string): Promise<Reading | undefined> {
  const db = await requireDb()
  return db.readings.get(id)
}

/** 去除前後空白後完全相同、未刪除、在 since 之後建立的紀錄是否存在（重複提問提醒） */
export async function hasExactQuestionSince(question: string, since: Date): Promise<boolean> {
  const db = await requireDb()
  const q = question.trim()
  const hit = await db.readings
    .where('[createdAt+id]')
    .aboveOrEqual([since.toISOString(), ''])
    .filter(r => !r.deletedAt && r.question.trim() === q)
    .first()
  return Boolean(hit)
}

export type ReadingPatch = Partial<Pick<Reading, 'question' | 'note' | 'followUp' | 'starred'>>

function checkPatch(patch: ReadingPatch): ReadingPatch {
  const out: ReadingPatch = { ...patch }
  if (out.question !== undefined) {
    out.question = out.question.trim()
    if (len(out.question) < QUESTION_MIN || len(out.question) > QUESTION_MAX) throw new RangeError(`問題要 ${QUESTION_MIN} 到 ${QUESTION_MAX} 字`)
  }
  if (out.note !== undefined && len(out.note) > NOTE_MAX) throw new RangeError(`筆記最多 ${NOTE_MAX} 字`)
  if (out.followUp && len(out.followUp.text) > NOTE_MAX) throw new RangeError(`事後回顧最多 ${NOTE_MAX} 字`)
  return out
}

/** 只能改問題、筆記、事後回顧與星號；六爻與方法不可改。expectedRev 與資料庫不同時拋出 WRITE_CONFLICT */
export async function update(id: string, patch: ReadingPatch, expectedRev: number, now = new Date()): Promise<Reading> {
  const db = await requireDb()
  const clean = checkPatch(patch)
  return db.transaction('rw', db.readings, async () => {
    const current = await db.readings.get(id)
    if (!current || current.rev !== expectedRev) throw new AppError('WRITE_CONFLICT')
    const next: Reading = { ...current, ...clean, rev: current.rev + 1, updatedAt: now.toISOString() }
    await db.readings.put(next)
    return next
  }).catch(rethrow)
}

/** 在同一個 readwrite 交易內比對 rev 後修改；不符時拋出 WRITE_CONFLICT */
async function mutate(id: string, expectedRev: number, change: (current: Reading) => Partial<Reading>, now: Date): Promise<Reading> {
  const db = await requireDb()
  return db.transaction('rw', db.readings, async () => {
    const current = await db.readings.get(id)
    if (!current || current.rev !== expectedRev) throw new AppError('WRITE_CONFLICT')
    const next: Reading = { ...current, ...change(current), rev: current.rev + 1, updatedAt: now.toISOString() }
    await db.readings.put(next)
    return next
  }).catch(rethrow)
}

/** 軟刪除：列表隱藏，5 秒內可復原，10 秒後由 purgeDeleted 永久刪除 */
export const softDelete = (id: string, expectedRev: number, now = new Date()) =>
  mutate(id, expectedRev, () => ({ deletedAt: now.toISOString() }), now)

export const restore = (id: string, expectedRev: number, now = new Date()) =>
  mutate(id, expectedRev, () => ({ deletedAt: null }), now)

export const PURGE_AFTER_MS = 10_000

/** 永久刪除軟刪除超過 10 秒的紀錄；回傳刪除筆數 */
export async function purgeDeleted(now = new Date()): Promise<number> {
  const db = await requireDb()
  const limit = now.getTime() - PURGE_AFTER_MS
  return db.readings.filter(r => r.deletedAt !== null && Date.parse(r.deletedAt) <= limit).delete()
}

export interface ListFilters {
  /** 問題、筆記、事後回顧的文字搜尋 */
  query?: string
  method?: Method
  category?: Category
  /** true 只看已回顧、false 只看未回顧 */
  reviewed?: boolean
  starred?: boolean
  since?: string
}

export interface Cursor {
  createdAt: string
  id: string
}

export const PAGE_SIZE = 50

function matches(r: Reading, f: ListFilters): boolean {
  if (r.deletedAt) return false
  if (f.method && r.method !== f.method) return false
  if (f.category && r.category !== f.category) return false
  if (f.reviewed !== undefined && (r.followUp !== null) !== f.reviewed) return false
  if (f.starred && r.starred !== 1) return false
  if (f.since && r.createdAt < f.since) return false
  const q = f.query?.trim()
  if (q && ![r.question, r.note, r.followUp?.text ?? ''].some(t => t.includes(q))) return false
  return true
}

/**
 * 依 [createdAt+id] 由新到舊，先排除已刪除並套用篩選，再取一頁。多讀一筆判斷還有沒有下一頁，
 * 篩選後剛好整頁時才不會給出空的下一頁；同一毫秒建立的紀錄靠 id 排序，不會漏掉。
 */
export async function queryList(db: IchingDB, filters: ListFilters = {}, options: { limit?: number; before?: Cursor } = {}) {
  const limit = options.limit ?? PAGE_SIZE
  const range = options.before
    ? db.readings.where('[createdAt+id]').below([options.before.createdAt, options.before.id])
    : db.readings.orderBy('[createdAt+id]')
  const rows = await range.reverse().filter(r => matches(r, filters)).limit(limit + 1).toArray()
  const items = rows.slice(0, limit)
  const last = items.at(-1)
  return { items, next: rows.length > limit && last ? { createdAt: last.createdAt, id: last.id } : undefined }
}

export async function list(filters: ListFilters = {}, options: { limit?: number; before?: Cursor } = {}) {
  return queryList(await requireDb(), filters, options)
}

/** 未刪除的紀錄數 */
export async function countActive(): Promise<number> {
  const db = await requireDb()
  return db.readings.filter(r => !r.deletedAt).count()
}
