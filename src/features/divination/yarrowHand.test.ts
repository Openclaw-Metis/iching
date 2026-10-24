import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { draft as draftRepo, openStorage, provideStorage, type CastDraft } from '../../storage/index.ts'
import { applySplit, handStart, stepNumber } from './yarrowHand.ts'

// 固定的分法與手算結果（removed = 掛一 1 + 左餘 + 右餘，餘數整除時算 4）：
// 初爻 49→24 去 9、40→20 去 8、32→16 去 8，剩 24 為 6
// 二爻 49→21 去 5、44→22 去 4、40→18 去 4，剩 36 為 9
// 三爻 49→25 去 5、44→20 去 8、36→17 去 4，剩 32 為 8
// 四爻 49→1 去 5、44→42 去 4、40→3 去 8，剩 32 為 8（左堆最少與最多的邊界）
// 五爻 49→30 去 5、44→11 去 8、36→12 去 8，剩 28 為 7
// 上爻 49→8 去 9、40→9 去 4、36→5 去 4，剩 32 為 8
const LEFTS = [24, 20, 16, 21, 22, 18, 25, 20, 17, 1, 42, 3, 30, 11, 12, 8, 9, 5]
const REMOVED = [9, 8, 8, 5, 4, 4, 5, 8, 4, 5, 4, 8, 5, 8, 8, 9, 4, 4]
const LINES = [6, 9, 8, 8, 7, 8]

const start = (): CastDraft => ({
  key: 'current', castId: 'hand-1', phase: 'casting', rev: 0, question: '親手分蓍測試', category: 'general', method: 'yarrow', yarrowMode: 'hand',
  lines: [], yarrow: handStart(), startedAt: '2026-10-24T00:00:00.000Z', updatedAt: '2026-10-24T00:00:00.000Z',
})

describe('親手分蓍', () => {
  it('以固定的 left 序列跑完 18 變，結果與手算一致', () => {
    let d = start()
    const removed: number[] = []
    LEFTS.forEach((left, i) => {
      expect(stepNumber(d.yarrow!)).toBe(i + 1)
      const r = applySplit(d, left)
      removed.push(r.step.change.removed)
      d = r.draft
    })
    expect(removed).toEqual(REMOVED)
    expect(d.lines).toEqual(LINES)
    expect(d.phase).toBe('complete')
    expect(d.yarrow).toBeNull()
  })

  it('分到零根時拋錯（左堆至少一根、右堆掛一後至少一根）', () => {
    expect(() => applySplit(start(), 0)).toThrow(RangeError)
    expect(() => applySplit(start(), 48)).toThrow(RangeError)
  })

  it('草稿在第 7 變中斷後重開，從第 7 變繼續，結果與沒中斷相同', async () => {
    const factory = new IDBFactory()
    provideStorage(await openStorage({ indexedDB: factory, IDBKeyRange }))
    let d = start()
    let rev = 0
    for (const left of LEFTS.slice(0, 6)) {
      d = applySplit(d, left).draft
      rev = await draftRepo.save({ ...d, rev })
    }
    // 模擬關閉分頁：重新開啟資料庫並讀回草稿
    provideStorage(await openStorage({ indexedDB: factory, IDBKeyRange }))
    let resumed = (await draftRepo.get())!
    expect(resumed.lines).toEqual([6, 9])
    expect(stepNumber(resumed.yarrow!)).toBe(7)
    for (const left of LEFTS.slice(6)) resumed = applySplit(resumed, left).draft
    expect(resumed.lines).toEqual(LINES)
  })
})
