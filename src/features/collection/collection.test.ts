import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { openStorage, provideStorage, requireDb } from '../../storage/index.ts'
import { applyImport, exportAll, previewImport, validateTables } from '../backup/index.ts'
import { toggleFavorite } from './favorites.ts'
import { isValidRef, parseQuoteId, quoteHref, quoteIdOf, quoteSource, quoteText, toggleQuote } from './quotes.ts'

const fresh = async () => provideStorage(await openStorage({ indexedDB: new IDBFactory(), IDBKeyRange }))
beforeEach(fresh)

describe('收藏卦牌', () => {
  it('切換兩次回到未收藏', async () => {
    expect(await toggleFavorite(3)).toBe(true)
    expect(await (await requireDb()).favorites.count()).toBe(1)
    expect(await toggleFavorite(3)).toBe(false)
    expect(await (await requireDb()).favorites.count()).toBe(0)
    await expect(toggleFavorite(65)).rejects.toThrow(RangeError)
  })
})

describe('金句', () => {
  it('id 解析：line-0 與坤卦 useAll', () => {
    expect(parseQuoteId('3:line:0')).toEqual({ hexagram: 3, kind: 'line', position: 0 })
    expect(parseQuoteId('2:useAll')).toEqual({ hexagram: 2, kind: 'useAll' })
    expect(parseQuoteId('29:daxiang')).toEqual({ hexagram: 29, kind: 'daxiang' })
    expect(parseQuoteId('64:judgment')).toEqual({ hexagram: 64, kind: 'judgment' })
    expect(parseQuoteId('3:line:6')).toBeNull()
    expect(parseQuoteId('3:line')).toBeNull()
    expect(parseQuoteId('3:judgment:1')).toBeNull()
    expect(parseQuoteId('65:judgment')).toBeNull()
  })

  it('非乾坤的 useAll 被拒絕', async () => {
    expect(parseQuoteId('3:useAll')).toBeNull()
    expect(isValidRef({ hexagram: 3, kind: 'useAll' })).toBe(false)
    await expect(toggleQuote({ hexagram: 3, kind: 'useAll' })).rejects.toThrow(RangeError)
  })

  it('文字從原文讀取，出處與深層連結正確', () => {
    expect(quoteText({ hexagram: 1, kind: 'line', position: 0 })).toBe('潛龍勿用。')
    expect(quoteSource({ hexagram: 1, kind: 'line', position: 0 })).toBe('乾初九')
    expect(quoteSource({ hexagram: 2, kind: 'useAll' })).toBe('坤用六')
    expect(quoteSource({ hexagram: 3, kind: 'daxiang' })).toBe('屯大象')
    expect(quoteHref({ hexagram: 3, kind: 'line', position: 2 })).toBe('/gua/3?tab=text&focus=line-2')
    expect(quoteHref({ hexagram: 2, kind: 'useAll' })).toBe('/gua/2?tab=text&focus=use')
    expect(quoteHref({ hexagram: 5, kind: 'judgment' })).toBe('/gua/5?tab=text&focus=judgment')
  })

  it('切換兩次回到未收藏；所有種類都通過備份驗證', async () => {
    const refs = [
      { hexagram: 1, kind: 'judgment' as const }, { hexagram: 29, kind: 'daxiang' as const },
      { hexagram: 3, kind: 'line' as const, position: 0 }, { hexagram: 1, kind: 'useAll' as const }, { hexagram: 2, kind: 'useAll' as const },
    ]
    for (const r of refs) expect(await toggleQuote(r)).toBe(true)
    const rows = await (await requireDb()).quotes.toArray()
    expect(rows.map(r => r.id).sort()).toEqual(refs.map(quoteIdOf).sort())
    const check = validateTables({ quotes: JSON.parse(JSON.stringify(rows)) }).quotes
    expect(check.valid).toHaveLength(5)
    expect(check.invalid).toBe(0)
    expect(await toggleQuote(refs[0])).toBe(false)
    expect(await (await requireDb()).quotes.count()).toBe(4)
  })

  it('匯出匯入後收藏一致', async () => {
    await toggleFavorite(11)
    await toggleFavorite(12)
    await toggleQuote({ hexagram: 3, kind: 'line', position: 0 })
    await toggleQuote({ hexagram: 2, kind: 'useAll' })
    const { files } = await exportAll()
    const before = await (await requireDb()).quotes.toArray()
    await fresh()
    await applyImport(await previewImport(files.map(f => ({ name: f.name, size: f.text.length, text: async () => f.text }))), 'merge')
    const db = await requireDb()
    expect((await db.favorites.toArray()).map(f => f.hexagram).sort()).toEqual([11, 12])
    expect(await db.quotes.toArray()).toEqual(before)
  })
})
