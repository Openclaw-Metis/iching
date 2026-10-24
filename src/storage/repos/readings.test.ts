import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { isAppError } from '../../lib/errors.ts'
import { provideStorage, requireDb } from '../connection.ts'
import type { CastDraft } from '../db.ts'
import { openStorage } from '../open.ts'
import * as draft from './draft.ts'
import * as readings from './readings.ts'

let factory: IDBFactory
beforeEach(async () => {
  factory = new IDBFactory()
  provideStorage(await openStorage({ indexedDB: factory, IDBKeyRange }))
})

const NOW = new Date('2026-10-24T03:00:00.000Z')

function makeDraft(over: Partial<CastDraft> = {}): CastDraft {
  return {
    key: 'current', castId: crypto.randomUUID(), phase: 'complete', rev: 0, question: '要不要接下新的專案？', category: 'career',
    method: 'coins', yarrowMode: 'quick', lines: [7, 6, 8, 8, 7, 8], yarrow: null, startedAt: NOW.toISOString(), updatedAt: NOW.toISOString(), ...over,
  }
}

const conflict = (e: unknown) => isAppError(e, 'WRITE_CONFLICT')

describe('completeCast', () => {
  it('以 castId 建立紀錄並在同一交易刪除草稿，算出本卦、之卦與變爻', async () => {
    const d = makeDraft()
    await draft.save(d)
    const r = await readings.completeCast(d, NOW)
    expect(r).toMatchObject({ id: d.castId, rev: 1, starred: 0, primary: 3, result: 60, moving: [1], method: 'coins', note: '', followUp: null, deletedAt: null })
    expect(await draft.get()).toBeUndefined()
  })

  it('重跑不會建立第二筆：紀錄已建立但草稿還沒刪除就中斷（AC-07）', async () => {
    const d = makeDraft()
    const first = await readings.completeCast(d, NOW)
    // 模擬中斷：草稿又被寫回去
    await (await requireDb()).castDraft.put({ ...d, rev: 3 })
    const again = await readings.completeCast(d, new Date('2026-10-24T03:05:00.000Z'))
    expect(again).toEqual(first)
    expect(await (await requireDb()).readings.count()).toBe(1)
    expect(await draft.get()).toBeUndefined()
  })

  it('大衍筮法依模式記成 yarrow-hand 或 yarrow-quick', async () => {
    expect((await readings.completeCast(makeDraft({ method: 'yarrow', yarrowMode: 'hand' }))).method).toBe('yarrow-hand')
    expect((await readings.completeCast(makeDraft({ method: 'yarrow', yarrowMode: 'quick' }))).method).toBe('yarrow-quick')
  })

  it('不足六爻時拒絕', async () => {
    await expect(readings.completeCast(makeDraft({ lines: [7, 7, 7] }))).rejects.toThrow(RangeError)
  })
})

describe('hasExactQuestionSince', () => {
  it('去除前後空白後完全相同才算，多一個字不算（AC-08）', async () => {
    await readings.completeCast(makeDraft({ question: '要不要搬家？' }), NOW)
    const since = new Date(NOW.getTime() - 24 * 3600_000)
    expect(await readings.hasExactQuestionSince('  要不要搬家？ ', since)).toBe(true)
    expect(await readings.hasExactQuestionSince('要不要搬家呢？', since)).toBe(false)
    expect(await readings.hasExactQuestionSince('要不要搬家？', new Date(NOW.getTime() + 1000))).toBe(false)
  })

  it('已刪除的紀錄不算', async () => {
    const r = await readings.completeCast(makeDraft({ question: '要不要搬家？' }), NOW)
    await (await requireDb()).readings.update(r.id, { deletedAt: NOW.toISOString() })
    expect(await readings.hasExactQuestionSince('要不要搬家？', new Date(0))).toBe(false)
  })
})

describe('跨分頁寫入比對 rev（TC-13）', () => {
  it('兩個帶相同 rev 的 draft.save 同時發出，只有一個成功，另一個拋 WRITE_CONFLICT', async () => {
    const d = makeDraft({ phase: 'casting', lines: [7] })
    await draft.save(d)
    const saved = await draft.get()
    const results = await Promise.allSettled([
      draft.save({ ...saved!, lines: [7, 8] }),
      draft.save({ ...saved!, lines: [7, 9] }),
    ])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
    expect(rejected).toHaveLength(1)
    expect(conflict(rejected[0].reason)).toBe(true)
  })

  it('草稿已被清除（另一個分頁完成或放棄）時，舊分頁的寫入被拒絕', async () => {
    const d = makeDraft({ phase: 'casting', lines: [7] })
    await draft.save(d)
    await draft.clear(d.castId)
    await expect(draft.save({ ...d, rev: 1 })).rejects.toSatisfy(conflict)
  })

  it('另一個分頁開始了新的起卦時，舊分頁的寫入被拒絕', async () => {
    const old = makeDraft({ phase: 'casting', lines: [7] })
    await draft.save(old)
    await draft.clear()
    await draft.save(makeDraft({ phase: 'question', lines: [] }))
    await expect(draft.save({ ...old, rev: 1 })).rejects.toSatisfy(conflict)
  })

  it('兩個帶相同 rev 的 readings.update 同時發出，只有一個成功（AC-29）', async () => {
    const r = await readings.completeCast(makeDraft(), NOW)
    const results = await Promise.allSettled([
      readings.update(r.id, { note: '甲分頁' }, r.rev),
      readings.update(r.id, { note: '乙分頁' }, r.rev),
    ])
    expect(results.filter(x => x.status === 'fulfilled')).toHaveLength(1)
    expect(conflict((results.find(x => x.status === 'rejected') as PromiseRejectedResult).reason)).toBe(true)
    const stored = await readings.get(r.id)
    expect(stored!.rev).toBe(2)
  })

  it('update 只改允許的欄位並加 rev', async () => {
    const r = await readings.completeCast(makeDraft(), NOW)
    const next = await readings.update(r.id, { note: '先觀望', starred: 1 }, 1)
    expect(next).toMatchObject({ note: '先觀望', starred: 1, rev: 2, lines: r.lines, primary: r.primary })
    await expect(readings.update(r.id, { question: '短' }, 2)).rejects.toThrow(RangeError)
  })
})

describe('草稿（TC-12）', () => {
  it('建立草稿、寫 3 爻後重新開啟資料庫，草稿仍有 3 爻且 phase 為 casting', async () => {
    const d = makeDraft({ phase: 'casting', lines: [] })
    await draft.save(d)
    const saved = await draft.get()
    await draft.save({ ...saved!, lines: [7, 8, 9] })
    provideStorage(await openStorage({ indexedDB: factory, IDBKeyRange }))
    expect(await draft.get()).toMatchObject({ castId: d.castId, phase: 'casting', lines: [7, 8, 9] })
  })
})
