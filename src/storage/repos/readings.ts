// 占卜紀錄。六爻完成時以草稿的 castId 為主鍵建立，同一個交易刪除草稿，中斷後重來也不會出現第二筆。
// 會被多個分頁修改，所以修改一律在同一個 readwrite 交易內比對 rev。

import { hexagramsOf } from '../../lib/castLines.ts'
import { AppError, isQuotaError } from '../../lib/errors.ts'
import { requireDb } from '../connection.ts'
import type { CastDraft, Method, Reading } from '../db.ts'

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
