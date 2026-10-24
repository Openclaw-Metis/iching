import { beforeEach, describe, expect, it } from 'vitest'
import { CARD_LRU_KEY, touch } from './cardCache.ts'

// 假的 Cache API：記住每次刪除的網址
function fakeCaches() {
  const deleted: string[] = []
  const opened: string[] = []
  const storage = {
    open: async (name: string) => {
      opened.push(name)
      return { delete: async (url: string) => { deleted.push(url); return true } }
    },
  } as unknown as CacheStorage
  return { storage, deleted, opened }
}

beforeEach(() => localStorage.clear())

describe('卡圖快取整理', () => {
  it('第 31 卦時刪除最舊一卦的四層', async () => {
    const c = fakeCaches()
    for (let n = 1; n <= 30; n++) expect(await touch(n, c.storage)).toEqual([])
    expect(c.deleted).toEqual([])
    expect(await touch(31, c.storage)).toEqual([1])
    expect(c.opened).toEqual(['card-layers'])
    expect(c.deleted.map(u => new URL(u).pathname)).toEqual(['background', 'subject', 'fx', 'text'].map(l => `/cards/01/${l}.webp`))
    expect(JSON.parse(localStorage.getItem(CARD_LRU_KEY)!)).toHaveLength(30)
  })

  it('重複開啟同一卦只移動順序', async () => {
    const c = fakeCaches()
    for (let n = 1; n <= 30; n++) await touch(n, c.storage)
    expect(await touch(1, c.storage)).toEqual([])
    expect(JSON.parse(localStorage.getItem(CARD_LRU_KEY)!)[0]).toBe(1)
    // 現在最舊的是 2
    expect(await touch(40, c.storage)).toEqual([2])
    expect(c.deleted).toHaveLength(4)
  })

  it('localStorage 內容壞掉時從頭記起；沒有 Cache API 也不出錯', async () => {
    localStorage.setItem(CARD_LRU_KEY, '{oops')
    expect(await touch(5, undefined)).toEqual([])
    expect(JSON.parse(localStorage.getItem(CARD_LRU_KEY)!)).toEqual([5])
  })
})
