// 卡圖快取整理（規格「通知與背景執行」）：卡圖四層由 service worker 存在 card-layers 快取，這裡記住最近開過的卦，
// 超過 30 卦時刪掉最舊那一卦的四層。以卦為單位，四層一起保留或一起刪除。
// 離線時若某一卦缺任一層，HoloCard 會改用已預先快取的 thumb.webp 平面卡圖。失敗一律靜默略過。

import { cardAsset } from '../data/cards.ts'

export const CARD_LRU_KEY = 'iching:card-lru'
export const CARD_CACHE = 'card-layers'
export const CARD_LIMIT = 30
const LAYERS = ['background', 'subject', 'fx', 'text'] as const

function read(): number[] {
  try {
    const list = JSON.parse(localStorage.getItem(CARD_LRU_KEY) ?? '[]')
    return Array.isArray(list) ? list.filter(n => Number.isInteger(n) && n >= 1 && n <= 64) : []
  } catch {
    return []
  }
}

/** 開啟一卦的卡圖時呼叫；回傳被淘汰的卦序 */
export async function touch(n: number, cacheStorage: CacheStorage | undefined = globalThis.caches): Promise<number[]> {
  const list = [n, ...read().filter(x => x !== n)]
  const evicted = list.slice(CARD_LIMIT)
  try { localStorage.setItem(CARD_LRU_KEY, JSON.stringify(list.slice(0, CARD_LIMIT))) } catch { /* 記不住只是少了離線卡圖 */ }
  if (!evicted.length || !cacheStorage) return evicted
  try {
    const cache = await cacheStorage.open(CARD_CACHE)
    // 快取鍵是完整網址
    await Promise.all(evicted.flatMap(e => LAYERS.map(layer => cache.delete(new URL(cardAsset(e, layer), location.origin).href))))
  } catch { /* 靜默略過 */ }
  return evicted
}
