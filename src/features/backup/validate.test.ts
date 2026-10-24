import { describe, expect, it } from 'vitest'
import type { Reading } from '../../storage/index.ts'
import { partialBackup } from './format.ts'
import { parseBackupText, validateEnvelope, validateReading, validateTables } from './validate.ts'

const reading = (over: Partial<Reading> = {}): Reading => ({
  id: 'b8f4c1de-5a7e-4c9b-9a41-0d3f6e2a1c55', createdAt: '2026-10-24T03:00:00.000Z', updatedAt: '2026-10-24T03:00:00.000Z', rev: 1,
  question: '要不要接下新的專案？', category: 'career', method: 'coins', lines: [7, 6, 8, 8, 7, 8], primary: 3, result: 60, moving: [1],
  note: '', followUp: null, starred: 0, v: 1, deletedAt: null, ...over,
})

const roundTrip = (file: unknown) => validateEnvelope(parseBackupText(JSON.stringify(file)))

describe('備份檔驗證', () => {
  it('保存失敗時下載的單筆檔通過驗證（AC-09）', () => {
    const env = roundTrip(partialBackup(reading()))
    expect(env.scope).toBe('partial')
    expect(env.set).toMatchObject({ index: 1, total: 1 })
    const tables = validateTables(env.data)
    expect(tables.readings).toMatchObject({ corrected: 0, invalid: 0 })
    expect(tables.readings!.valid).toEqual([reading()])
  })

  it('lines 與 primary 不一致時以重算值為準並計入已修正', () => {
    const env = roundTrip(partialBackup(reading({ primary: 1, result: 1, moving: [] })))
    const t = validateTables(env.data).readings!
    expect(t.corrected).toBe(1)
    expect(t.valid[0]).toMatchObject({ primary: 3, result: 60, moving: [1] })
  })

  it('starred 接受布林，問題去除前後空白', () => {
    const r = validateReading({ ...reading(), starred: true, question: '  要不要搬家？ ' } as never)
    expect(r.value).toMatchObject({ starred: 1, question: '要不要搬家？' })
    expect(r.corrected).toBe(false)
  })

  it('不合法的筆數略過：爻值錯誤、問題太短、類別不明', () => {
    const file = partialBackup(reading())
    file.data.readings = [reading(), { ...reading(), lines: [7, 7, 7] }, { ...reading(), question: '短' }, { ...reading(), category: 'money' }, 'oops']
    const t = validateTables(roundTrip(file).data).readings!
    expect(t.valid).toHaveLength(1)
    expect(t.invalid).toBe(4)
  })

  it('丟棄 __proto__、constructor、prototype 等鍵與未知欄位', () => {
    const text = JSON.stringify(partialBackup(reading())).replace('"note":""', '"note":"","__proto__":{"polluted":true},"constructor":1,"extra":"x"')
    const env = validateEnvelope(parseBackupText(text))
    const row = validateTables(env.data).readings!.valid[0] as Record<string, unknown>
    expect(Object.keys(row)).not.toContain('extra')
    expect(Object.prototype.hasOwnProperty.call(row, '__proto__')).toBe(false)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('不是本站的檔案、JSON 格式錯誤時拋出 IMPORT_INVALID_FILE', () => {
    expect(() => roundTrip({ app: 'other', format: 1 })).toThrow(expect.objectContaining({ code: 'IMPORT_INVALID_FILE' }))
    expect(() => parseBackupText('{not json')).toThrow(expect.objectContaining({ code: 'IMPORT_INVALID_FILE' }))
  })

  it('較新格式的檔案拋出 IMPORT_NEWER_FORMAT', () => {
    expect(() => roundTrip({ ...partialBackup(reading()), format: 99 })).toThrow(expect.objectContaining({ code: 'IMPORT_NEWER_FORMAT' }))
    expect(() => roundTrip({ ...partialBackup(reading()), schema: 2 })).toThrow(expect.objectContaining({ code: 'IMPORT_NEWER_FORMAT' }))
  })

  it('巢狀超過 8 層時拋出 IMPORT_TOO_LARGE', () => {
    let deep: unknown = 1
    for (let i = 0; i < 9; i++) deep = [deep]
    expect(() => parseBackupText(JSON.stringify(deep))).toThrow(expect.objectContaining({ code: 'IMPORT_TOO_LARGE' }))
  })
})
