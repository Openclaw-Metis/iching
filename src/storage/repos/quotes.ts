// 金句：只存出處（卦序、種類、爻位），文字顯示時從原文讀取，不存快照。

import { requireDb } from '../connection.ts'
import type { IchingDB, Quote, QuoteKind } from '../db.ts'

/** 金句 id 為「卦序:種類[:爻位]」；只有 line 帶 0 到 5 的爻位（初爻為 0） */
export const quoteId = (hexagram: number, kind: QuoteKind, position?: number) =>
  kind === 'line' ? `${hexagram}:line:${position}` : `${hexagram}:${kind}`

export interface QuoteRef {
  hexagram: number
  kind: QuoteKind
  position?: number
}

/** 切換收藏；回傳切換後是否為收藏。ref 是否合法由呼叫端（features/collection）先檢查 */
export async function toggle(ref: QuoteRef, now = new Date()): Promise<boolean> {
  const db = await requireDb()
  const id = quoteId(ref.hexagram, ref.kind, ref.position)
  return db.transaction('rw', db.quotes, async () => {
    if (await db.quotes.get(id)) {
      await db.quotes.delete(id)
      return false
    }
    const row: Quote = { id, hexagram: ref.hexagram, kind: ref.kind, ...(ref.kind === 'line' ? { position: ref.position } : {}), addedAt: now.toISOString() }
    await db.quotes.add(row)
    return true
  })
}

/** 依加入時間，新的在前 */
export const listOf = (db: IchingDB): Promise<Quote[]> => db.quotes.orderBy('addedAt').reverse().toArray()
export const hasOf = async (db: IchingDB, id: string) => Boolean(await db.quotes.get(id))
