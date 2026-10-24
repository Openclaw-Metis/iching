import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '../../lib/errors.ts'
import { draft as draftRepo, openStorage, provideStorage, type CastDraft } from '../../storage/index.ts'
import { createDraftQueue, type DraftSaveState } from './draftQueue.ts'

const base = (): CastDraft => ({
  key: 'current', castId: 'cast-1', phase: 'casting', rev: 0, question: '要不要接下新的專案？', category: 'career',
  method: 'coins', yarrowMode: 'quick', lines: [], yarrow: null, startedAt: '2026-10-24T00:00:00.000Z', updatedAt: '2026-10-24T00:00:00.000Z',
})

describe('草稿佇列', () => {
  it('寫入失敗後進度留在記憶體，下一次寫入補上所有欄位', async () => {
    const written: CastDraft[] = []
    let fail = true
    const states: DraftSaveState[] = []
    const queue = createDraftQueue({
      async save(s) {
        if (fail) throw new DOMException('quota', 'QuotaExceededError')
        written.push(s)
        return s.rev + 1
      },
      onState: s => states.push(s),
    })
    await queue.reset(base())
    expect(await queue.update({ ...base(), question: '改過的問題', lines: [7] })).toBe(false)
    expect(states.at(-1)).toBe('failed')
    expect(queue.current()?.lines).toEqual([7])

    fail = false
    expect(await queue.update({ ...queue.current()!, lines: [7, 8] })).toBe(true)
    expect(written).toHaveLength(1)
    expect(written[0]).toMatchObject({ question: '改過的問題', lines: [7, 8], rev: 0 })
    expect(queue.current()?.rev).toBe(1)
    expect(states.at(-1)).toBe('saved')
  })

  it('寫入依序執行，較舊的寫入不會覆蓋較新的進度（以 fake-indexeddb 整合）', async () => {
    provideStorage(await openStorage({ indexedDB: new IDBFactory(), IDBKeyRange }))
    const order: number[] = []
    const queue = createDraftQueue({
      async save(s) {
        // 第一筆刻意慢一點，讓第二次變動在寫入途中發生
        if (s.lines.length === 1) await new Promise(r => setTimeout(r, 30))
        const rev = await draftRepo.save(s)
        order.push(s.lines.length)
        return rev
      },
    })
    await queue.reset(base())
    const first = queue.update({ ...base(), lines: [7] })
    const second = queue.update({ ...base(), lines: [7, 8] })
    expect(await Promise.all([first, second])).toEqual([true, true])
    expect(order).toEqual([1, 2])
    const stored = await draftRepo.get()
    expect(stored?.lines).toEqual([7, 8])
    expect(stored?.rev).toBe(2)
    expect(queue.current()?.rev).toBe(2)
  })

  it('問題輸入延後寫入，連續輸入只寫最後一次', async () => {
    const written: string[] = []
    const queue = createDraftQueue({ async save(s) { written.push(s.question); return s.rev + 1 } })
    await queue.reset({ ...base(), phase: 'question' })
    const a = queue.update({ ...base(), question: '要' }, { debounceMs: 20 })
    const b = queue.update({ ...base(), question: '要不要' }, { debounceMs: 20 })
    expect(await Promise.all([a, b])).toEqual([true, true])
    expect(written).toEqual(['要不要'])
  })

  it('另一個分頁改過草稿時通知呼叫端重新載入', async () => {
    let conflicts = 0
    const queue = createDraftQueue({
      async save() { throw new AppError('WRITE_CONFLICT') },
      onConflict: () => { conflicts++ },
    })
    await queue.reset(base())
    expect(await queue.update({ ...base(), lines: [9] })).toBe(false)
    expect(conflicts).toBe(1)
    expect(queue.state()).toBe('idle')
  })

  it('reset 之後不再寫入舊草稿', async () => {
    const written: string[] = []
    const queue = createDraftQueue({ async save(s) { written.push(s.castId); return s.rev + 1 } })
    await queue.reset(base())
    void queue.update({ ...base(), question: '舊的' }, { debounceMs: 20 })
    await queue.reset(null)
    await new Promise(r => setTimeout(r, 40))
    expect(written).toEqual([])
  })
})
