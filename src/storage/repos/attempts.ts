// 課程與考核的作答進度（規格「核心資料模型」的 Attempt）。題目在開始時一次產生並整份存成快照，
// 中途離開再回來看到同一題、同樣的選項順序與先前的選擇。考核限當天：開始日期不是今天就作廢重出。
// 開始、選答、檢查、前進都在 readwrite 交易內完成，兩個分頁同時開同一課也只會有一筆進行中的作答。

import { AppError, isQuotaError } from '../../lib/errors.ts'
import { localDateKey } from '../../lib/dates.ts'
import { requireDb } from '../connection.ts'
import type { AnswerRecord, Attempt, QuestionSnapshot } from '../db.ts'

const rethrow = (e: unknown): never => {
  if (isQuotaError(e)) throw new AppError('STORAGE_QUOTA', undefined, { cause: e })
  throw e
}

export interface StartOptions {
  kind: Attempt['kind']
  target: string
  /** 今天的本地日期 */
  date: string
  /** 沒有可接續的作答時才呼叫，產生這次的全部題目 */
  build: () => QuestionSnapshot[]
  now?: Date
}

/** 回傳進行中的作答；考核跨日的先作廢，沒有就新建 */
export async function startOrResume({ kind, target, date, build, now = new Date() }: StartOptions): Promise<Attempt> {
  const db = await requireDb()
  const at = now.toISOString()
  return db.transaction('rw', db.attempts, async () => {
    const active = await db.attempts.where('[kind+target]').equals([kind, target]).filter(a => a.status === 'active').toArray()
    let resume: Attempt | undefined
    for (const a of active) {
      if ((kind === 'exam' && a.date !== date) || resume) await db.attempts.update(a.id, { status: 'void', updatedAt: at })
      else resume = a
    }
    if (resume) return resume
    const questions = build()
    const fresh: Attempt = {
      id: crypto.randomUUID(), kind, target, date, questions, answers: questions.map(() => null),
      position: 0, status: 'active', startedAt: at, updatedAt: at,
    }
    await db.attempts.add(fresh)
    return fresh
  }).catch(rethrow)
}

/** 只查不建：可接續的作答（考核限當天） */
export async function findActive(kind: Attempt['kind'], target: string, date: string): Promise<Attempt | undefined> {
  const db = await requireDb()
  const list = await db.attempts.where('[kind+target]').equals([kind, target]).filter(a => a.status === 'active').toArray()
  return list.find(a => kind === 'lesson' || a.date === date)
}

export async function get(id: string): Promise<Attempt | undefined> {
  const db = await requireDb()
  return db.attempts.get(id)
}

async function modify(id: string, change: ((a: Attempt) => Partial<Attempt>) | null, now: Date): Promise<Attempt> {
  const db = await requireDb()
  const result = await db.transaction('rw', db.attempts, async () => {
    const current = await db.attempts.get(id)
    if (!current) throw new AppError('WRITE_CONFLICT')
    if (current.kind === 'exam' && current.date !== localDateKey(now)) {
      if (current.status === 'active') await db.attempts.update(id, { status: 'void', updatedAt: now.toISOString() })
      return null
    }
    if (current.status !== 'active') throw new AppError('WRITE_CONFLICT')
    if (!change) return current
    const next = { ...current, ...change(current), updatedAt: now.toISOString() }
    await db.attempts.put(next)
    return next
  }).catch(rethrow)
  // 交易提交後才回報過期，否則拋錯會回滾剛寫入的 void。
  if (!result) throw new AppError('EXAM_EXPIRED')
  return result
}

/** 送出前同樣檢查日期，不能只在進入考核時檢查。 */
export const requireActive = (id: string, now = new Date()) => modify(id, null, now)

/** 寫入一題的作答；已檢查過的題目不能再改 */
export function saveAnswer(id: string, index: number, record: AnswerRecord, now = new Date()): Promise<Attempt> {
  return modify(id, a => {
    if (index < 0 || index >= a.questions.length) throw new RangeError(`沒有第 ${index + 1} 題`)
    if (a.answers[index]?.checked) throw new AppError('WRITE_CONFLICT')
    const answers = [...a.answers]
    answers[index] = record
    return { answers }
  }, now)
}

export const setPosition = (id: string, position: number, now = new Date()) => modify(id, () => ({ position }), now)

/** 完成或放棄（重新開始本課）時結束這次作答 */
export function close(id: string, status: 'done' | 'void', now = new Date()): Promise<Attempt> {
  return modify(id, () => ({ status }), now)
}
