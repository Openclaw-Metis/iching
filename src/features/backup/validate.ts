// 匯入前的驗證：外層、分卷資訊與逐筆資料。無效的筆數略過並計入預覽，不會整批失敗；
// 可以由其他欄位重算的值（占卜紀錄的本卦、之卦、變爻）以重算值為準並計入「已修正」。
// 所有物件都經 sanitize 重建：丟棄 __proto__、constructor、prototype 等鍵，巢狀超過 8 層即拒絕。

import { hexagramsOf, isLineValue, type LineValue } from '../../lib/castLines.ts'
import { AppError } from '../../lib/errors.ts'
import { SCHEMA_VERSION, type Category, type ExportedTable, type Method, type Reading } from '../../storage/index.ts'
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

/** 各資料表的逐筆驗證；Stage 3 補齊其餘資料表 */
export const RECORD_VALIDATORS: Partial<Record<ExportedTable, (raw: Json) => RecordCheck<unknown>>> = {
  readings: validateReading,
}

export interface TableCheck {
  valid: unknown[]
  corrected: number
  invalid: number
}

export function validateTables(data: BackupEnvelope['data']): Partial<Record<ExportedTable, TableCheck>> {
  const out: Partial<Record<ExportedTable, TableCheck>> = {}
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
