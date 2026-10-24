// 匯入預覽的元件測試（AC-09、TC-25 的畫面部分、Gherkin「匯入前預覽」）：顯示各類筆數與重複筆數，部分備份停用取代。

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openStorage, provideStorage, requireDb, type Reading } from '../../storage/index.ts'
import { partialBackup } from './format.ts'
import { ImportPreviewDialog } from './ImportPreviewDialog.tsx'
import { previewImport, type ImportSource } from './preview.ts'

beforeEach(async () => provideStorage(await openStorage({ indexedDB: new IDBFactory(), IDBKeyRange })))
afterEach(cleanup)

const json = (name: string, value: unknown): ImportSource => {
  const text = JSON.stringify(value)
  return { name, size: text.length, text: async () => text }
}

const reading = (i: number): Reading => {
  const at = new Date(Date.UTC(2026, 9, 1 + (i % 20), 9, i)).toISOString()
  return { id: `r${i}`, createdAt: at, updatedAt: at, rev: 1, question: `問題 ${i}`, category: 'general', method: 'coins', lines: [7, 7, 7, 8, 8, 8], primary: 11, result: 11, moving: [], note: '', followUp: null, starred: 0, v: 1, deletedAt: null }
}

describe('匯入預覽', () => {
  it('完整備份：顯示紀錄 12 筆、今日卦 30 筆、重複 2 筆，可選合併或取代', async () => {
    const db = await requireDb()
    await db.readings.bulkAdd([reading(0), reading(1)])
    const dailyDraws = Array.from({ length: 30 }, (_, i) => {
      const date = `2026-09-${String(i + 1).padStart(2, '0')}`
      return { date, hexagram: (i % 64) + 1, drawnAt: `${date}T01:00:00.000Z`, note: '', updatedAt: `${date}T01:00:00.000Z`, rev: 1 }
    })
    const file = { ...partialBackup(reading(0)), scope: 'full' as const, data: { readings: Array.from({ length: 12 }, (_, i) => reading(i)), dailyDraws } }
    const preview = await previewImport([json('backup.json', file)])
    expect(preview.counts.readings).toBe(12)
    expect(preview.counts.dailyDraws).toBe(30)
    expect(preview.duplicates).toBe(2)

    const onConfirm = vi.fn()
    render(<ImportPreviewDialog preview={preview} busy={false} onConfirm={onConfirm} onCancel={() => {}} />)
    expect(document.body.textContent).toContain('占卜紀錄')
    const radios = [...document.querySelectorAll<HTMLInputElement>('input[name="import-mode"]')]
    expect(radios.map(r => r.disabled)).toEqual([false, false])
    fireEvent.click(screen.getByText('合併並匯入'))
    expect(onConfirm).toHaveBeenCalledWith('merge')
  })

  it('單筆結果（部分備份）停用取代，只能合併', async () => {
    const preview = await previewImport([json('one.json', partialBackup(reading(3)))])
    expect(preview.scope).toBe('partial')
    const onConfirm = vi.fn()
    render(<ImportPreviewDialog preview={preview} busy={false} onConfirm={onConfirm} onCancel={() => {}} />)
    const replace = [...document.querySelectorAll<HTMLInputElement>('input[name="import-mode"]')][1]
    expect(replace.disabled).toBe(true)
    expect(screen.getByText('這個檔案只含一筆結果，只能合併。')).toBeTruthy()
    fireEvent.click(screen.getByText('合併並匯入'))
    expect(onConfirm).toHaveBeenCalledWith('merge')
  })
})
