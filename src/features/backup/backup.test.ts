import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { isAppError } from '../../lib/errors.ts'
import { openStorage, provideStorage, requireDb, type CastDraft, type Reading, type ReviewCard, type XpEvent } from '../../storage/index.ts'
import { applyImport } from './apply.ts'
import { exportAll, type ExportFile } from './exportAll.ts'
import { partialBackup } from './format.ts'
import { previewImport, type ImportSource } from './preview.ts'

const fresh = async () => provideStorage(await openStorage({ indexedDB: new IDBFactory(), IDBKeyRange }))
beforeEach(fresh)

const source = (f: ExportFile): ImportSource => ({ name: f.name, size: new Blob([f.text]).size, text: async () => f.text })
const json = (name: string, value: unknown): ImportSource => source({ name, text: JSON.stringify(value) })

let seq = 0
function reading(over: Partial<Reading> = {}): Reading {
  const at = new Date(Date.UTC(2026, 9, 1, 0, 0, seq++)).toISOString()
  return {
    id: crypto.randomUUID(), createdAt: at, updatedAt: at, rev: 1, question: '要不要接下新的專案？', category: 'career', method: 'coins',
    lines: [7, 6, 8, 8, 7, 8], primary: 3, result: 60, moving: [1], note: '', followUp: null, starred: 0, v: 1, deletedAt: null, ...over,
  }
}

const card = (over: Partial<ReviewCard> = {}): ReviewCard => ({
  id: '29:glyph', hexagram: 29, facet: 'glyph', due: '2026-10-30T00:00:00.000Z', addedAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-21T00:00:00.000Z', removedAt: null,
  fsrs: { due: '2026-10-30T00:00:00.000Z', stability: 3.2, difficulty: 5.1, elapsed_days: 0, scheduled_days: 9, learning_steps: 0, reps: 1, lapses: 0, state: 2, last_review: '2026-10-21T00:00:00.000Z' },
  ...over,
})

const xp = (key: string, at: string, over: Partial<XpEvent> = {}): XpEvent => ({ id: crypto.randomUUID(), key, at, date: at.slice(0, 10), amount: 10, source: 'lesson', ref: key.split(':')[1], ...over })

async function seedAll() {
  const db = await requireDb()
  await db.readings.bulkAdd([reading(), reading({ starred: 1, note: '筆記' }), reading({ followUp: { text: '回顧', writtenAt: '2026-10-10T00:00:00.000Z' } })])
  await db.dailyDraws.add({ date: '2026-10-23', hexagram: 29, drawnAt: '2026-10-23T01:00:00.000Z', note: '', updatedAt: '2026-10-23T01:00:00.000Z', rev: 1 })
  await db.favorites.add({ hexagram: 1, addedAt: '2026-10-22T00:00:00.000Z' })
  await db.quotes.bulkAdd([
    { id: '1:line:5', hexagram: 1, kind: 'line', position: 5, addedAt: '2026-10-22T00:00:00.000Z' },
    { id: '2:useAll', hexagram: 2, kind: 'useAll', addedAt: '2026-10-22T00:00:00.000Z' },
  ])
  await db.lessonProgress.add({ lessonId: 'S1-L1', stationId: 1, status: 'completed', step: 0, correct: 5, total: 5, completedAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z' })
  await db.examResults.add({ id: crypto.randomUUID(), attemptId: 'a1', stationId: 1, score: 9, passed: true, at: '2026-10-21T00:00:00.000Z' })
  await db.reviewCards.add(card())
  await db.reviewLogs.add({ id: crypto.randomUUID(), cardId: '29:glyph', sessionId: 's1', rating: 3, reviewedAt: '2026-10-21T00:00:00.000Z', elapsedMs: 2500 })
  await db.mastery.add({ id: '29:glyph', hexagram: 29, facet: 'glyph', firstCorrectAt: '2026-10-20T00:00:00.000Z' })
  await db.xpEvents.add(xp('lesson:S1-L1', '2026-10-20T00:00:00.000Z'))
  await db.checkIns.add({ date: '2026-10-20', goal: 30, reachedAt: '2026-10-20T03:00:00.000Z' })
  // 與上面的課程和考核一致：匯入後的成就補發不會再多出印章
  await db.seals.bulkAdd([{ id: 'first', earnedAt: '2026-10-20T00:00:00.000Z' }, { id: 'qian', earnedAt: '2026-10-21T00:00:00.000Z' }])
  await db.settings.bulkPut([
    { key: 'dailyGoal', value: 50, updatedAt: '2026-10-20T00:00:00.000Z' },
    { key: 'lastBackupAt', value: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' },
  ])
}

async function counts() {
  const db = await requireDb()
  return Object.fromEntries(await Promise.all(db.tables.map(async t => [t.name, await t.count()])))
}

describe('匯出與匯入', () => {
  it('匯出再匯入（合併）到乾淨的資料庫，各表筆數一致；只屬於裝置的設定不匯出（AC-20、TC-14）', async () => {
    await seedAll()
    const { files, counts: exported } = await exportAll()
    expect(files).toHaveLength(1)
    expect(files[0].name).toMatch(/^iching-backup-\d{8}\.json$/)
    expect(exported.settings).toBe(1)

    await fresh()
    const preview = await previewImport(files.map(source))
    expect(preview.counts).toEqual(exported)
    expect(preview.duplicates).toBe(0)
    const result = await applyImport(preview, 'merge')
    expect(result.written).toBe(Object.values(exported).reduce((a, b) => a + b, 0))
    const after = await counts()
    for (const [table, n] of Object.entries(exported)) expect(after[table], table).toBe(n)
  })

  it('合併時重複的筆數列在預覽，紀錄保留較新的一筆並在本機加 rev', async () => {
    const db = await requireDb()
    const shared = reading({ note: '舊的' })
    await db.readings.bulkAdd([shared, reading()])
    const newer = { ...shared, note: '新的', updatedAt: '2026-11-01T00:00:00.000Z', rev: 9 }
    const file = { ...partialBackup(reading()), scope: 'full' as const, data: { readings: [newer, reading(), reading()] } }
    const preview = await previewImport([json('b.json', file)])
    expect(preview.duplicates).toBe(1)
    await applyImport(preview, 'merge')
    expect(await db.readings.count()).toBe(4)
    expect(await db.readings.get(shared.id)).toMatchObject({ note: '新的', rev: 2 })
  })

  it('約 20 MB 的自產資料往返一次', async () => {
    const db = await requireDb()
    const note = '筆'.repeat(1999)
    await db.readings.bulkAdd(Array.from({ length: 3400 }, () => reading({ note })))
    const { files } = await exportAll()
    const size = new Blob([files[0].text]).size
    expect(size).toBeGreaterThan(20 * 1024 * 1024)
    expect(files).toHaveLength(1)
    await fresh()
    await applyImport(await previewImport(files.map(source)), 'merge')
    expect(await (await requireDb()).readings.count()).toBe(3400)
  }, 60_000)

  it('分卷門檻調為 1 MB 時多卷往返成功；少一卷時不寫入（TC-14）', async () => {
    await seedAll()
    const db = await requireDb()
    await db.readings.bulkAdd(Array.from({ length: 600 }, () => reading({ note: '卷'.repeat(1500) })))
    const before = await counts()
    const { files } = await exportAll({ maxBytes: 1024 * 1024 })
    expect(files.length).toBeGreaterThan(2)
    for (const f of files) expect(new Blob([f.text]).size).toBeLessThanOrEqual(1024 * 1024)
    expect(files[1].name).toMatch(/-2of\d+\.json$/)

    await fresh()
    await expect(previewImport(files.slice(1).map(source))).rejects.toSatisfy(e => isAppError(e, 'IMPORT_INCOMPLETE_SET') && (e as Error).message.includes('第 1 份'))
    expect((await counts()).readings).toBe(0)
    await applyImport(await previewImport([...files].reverse().map(source)), 'merge')
    const after = await counts()
    for (const t of ['readings', 'dailyDraws', 'favorites', 'quotes', 'lessonProgress', 'examResults', 'reviewCards', 'reviewLogs', 'mastery', 'xpEvents', 'checkIns', 'seals']) {
      expect(after[t], t).toBe(before[t])
    }
  }, 60_000)

  it('取代只留檔案內容，保留起卦草稿與只屬於裝置的設定', async () => {
    await seedAll()
    const { files } = await exportAll()
    const db = await requireDb()
    await db.readings.add(reading({ question: '匯出後才新增的' }))
    const draft: CastDraft = { key: 'current', castId: 'c1', phase: 'casting', rev: 1, question: '起卦中', category: 'general', method: 'coins', yarrowMode: 'quick', lines: [7], yarrow: null, startedAt: '', updatedAt: '' }
    await db.castDraft.put(draft)
    await db.attempts.put({ id: 'att', kind: 'lesson', target: 'S1-L2', date: '2026-10-24', questions: [], answers: [], position: 0, status: 'active', startedAt: '', updatedAt: '' })
    await applyImport(await previewImport(files.map(source)), 'replace')
    expect(await db.readings.count()).toBe(3)
    expect(await db.readings.filter(r => r.question === '匯出後才新增的').count()).toBe(0)
    expect(await db.castDraft.get('current')).toMatchObject({ castId: 'c1' })
    expect(await db.attempts.count()).toBe(0)
    expect(await db.settings.get('lastBackupAt')).toBeDefined()
  })

  it('部分備份（單筆結果）只能合併，不能取代（AC-09、TC-25）', async () => {
    await seedAll()
    const preview = await previewImport([json('iching-reading.json', partialBackup(reading()))])
    expect(preview.scope).toBe('partial')
    await expect(applyImport(preview, 'replace')).rejects.toSatisfy(e => isAppError(e, 'IMPORT_INVALID_FILE'))
    const before = await counts()
    await applyImport(preview, 'merge')
    const after = await counts()
    expect(after.readings).toBe(before.readings + 1)
    expect(after.xpEvents).toBe(before.xpEvents)
  })

  it('含 __proto__、錯誤型別、lines 與 primary 不一致、FSRS 欄位不合法的筆數依規則略過或修正（TC-15）', async () => {
    const file = {
      ...partialBackup(reading()), scope: 'full' as const,
      data: {
        readings: [reading({ primary: 1, result: 1, moving: [] }), { ...reading(), question: 42 }, JSON.parse('{"__proto__":{"x":1}}')],
        reviewCards: [card(), card({ id: '30:glyph', hexagram: 30, fsrs: { ...card().fsrs, state: 0, stability: 1 } }), card({ id: '31:image', hexagram: 31, facet: 'image', fsrs: { ...card().fsrs, difficulty: 12 } })],
        quotes: [{ id: '3:useAll', hexagram: 3, kind: 'useAll', addedAt: '2026-10-22T00:00:00.000Z' }],
        xpEvents: [xp('lesson:S1-L1', '2026-10-20T00:00:00.000Z', { amount: 999 })],
      },
    }
    const preview = await previewImport([json('x.json', file)])
    expect(preview.counts.readings).toBe(1)
    expect(preview.counts.reviewCards).toBe(1)
    expect(preview.counts.quotes).toBe(0)
    expect(preview.counts.xpEvents).toBe(0)
    expect(preview.corrected).toBe(1)
    expect(preview.invalid).toBe(6)
    await applyImport(preview, 'merge')
    expect((await (await requireDb()).readings.toArray())[0]).toMatchObject({ primary: 3, result: 60, moving: [1] })
  })

  it('超過 50 MB、非本站檔案、較新格式、混到不同組的分卷都不寫入（AC-21）', async () => {
    const huge: ImportSource = { name: 'big.json', size: 51 * 1024 * 1024, text: async () => { throw new Error('不該讀取') } }
    await expect(previewImport([huge])).rejects.toSatisfy(e => isAppError(e, 'IMPORT_TOO_LARGE'))
    await expect(previewImport([json('a.json', { hello: 'world' })])).rejects.toSatisfy(e => isAppError(e, 'IMPORT_INVALID_FILE'))
    await expect(previewImport([json('a.json', { ...partialBackup(reading()), format: 2 })])).rejects.toSatisfy(e => isAppError(e, 'IMPORT_NEWER_FORMAT'))
    const a = { ...partialBackup(reading()), set: { id: 'A', index: 1, total: 2 } }
    const b = { ...partialBackup(reading()), set: { id: 'B', index: 2, total: 2 } }
    await expect(previewImport([json('a.json', a), json('b.json', b)])).rejects.toSatisfy(e => isAppError(e, 'IMPORT_INCOMPLETE_SET'))
    expect((await counts()).readings).toBe(0)
  })

  it('寫入中途拋錯時整批回滾，資料不變', async () => {
    await seedAll()
    const before = await counts()
    // 同一個業務鍵的兩筆 XP 事件：取代時第二筆違反唯一索引，交易中止
    const file = {
      ...partialBackup(reading()), scope: 'full' as const,
      data: { readings: [reading(), reading()], xpEvents: [xp('lesson:S1-L2', '2026-10-20T00:00:00.000Z'), xp('lesson:S1-L2', '2026-10-21T00:00:00.000Z')] },
    }
    const preview = await previewImport([json('x.json', file)])
    await expect(applyImport(preview, 'replace')).rejects.toBeTruthy()
    expect(await counts()).toEqual(before)
  })

  it('XP 事件依 key 去重，保留較早的一筆', async () => {
    const db = await requireDb()
    await db.xpEvents.add(xp('lesson:S1-L1', '2026-10-20T00:00:00.000Z'))
    const earlier = xp('lesson:S1-L1', '2026-10-19T00:00:00.000Z')
    const file = { ...partialBackup(reading()), scope: 'full' as const, data: { xpEvents: [earlier, xp('lesson:S1-L2', '2026-10-21T00:00:00.000Z')] } }
    await applyImport(await previewImport([json('x.json', file)]), 'merge')
    expect(await db.xpEvents.count()).toBe(2)
    expect((await db.xpEvents.where('key').equals('lesson:S1-L1').first())?.at).toBe('2026-10-19T00:00:00.000Z')
  })

  it('匯入後補發印章與溫故卡（AC-31）', async () => {
    const db = await requireDb()
    const file = {
      ...partialBackup(reading()), scope: 'full' as const,
      data: {
        examResults: [{ id: 'e1', attemptId: 'a1', stationId: 2, score: 8, passed: true, at: '2026-10-21T00:00:00.000Z' }],
        mastery: [{ id: '30:image', hexagram: 30, facet: 'image', firstCorrectAt: '2026-10-20T00:00:00.000Z' }],
      },
    }
    await applyImport(await previewImport([json('x.json', file)]), 'merge')
    expect(await db.seals.get('dui')).toEqual({ id: 'dui', earnedAt: '2026-10-21T00:00:00.000Z' })
    expect(await db.reviewCards.get('30:image')).toBeTruthy()
  })
})
