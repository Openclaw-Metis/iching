// 納甲面板載入失敗（網站更新後舊分頁的程式包已不存在）時只有折疊區顯示錯誤，經文解讀照常
// （規格「納甲六爻盤：月建與日辰」）。

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Reading } from '../../storage/index.ts'
import { ReadingView } from './ResultStep.tsx'

vi.mock('../najia/index.ts', () => { throw new Error('Failed to fetch dynamically imported module') })

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const reading: Reading = {
  id: 'r-1', createdAt: '2026-11-12T15:05:00.000Z', castAt: '2026-11-12T14:55:00.000Z', castOffsetMinutes: 480, updatedAt: '2026-11-12T15:05:00.000Z', rev: 1,
  question: '要不要接下新的專案？', category: 'general', method: 'coins', lines: [7, 6, 8, 8, 7, 8], primary: 3, result: 60, moving: [1],
  note: '', followUp: null, starred: 0, v: 1, deletedAt: null,
}

describe('納甲折疊區的錯誤隔離', () => {
  it('程式包載入失敗時顯示說明與重新整理，主讀經文仍在畫面上', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<MemoryRouter><ReadingView reading={reading} /></MemoryRouter>)
    const details = screen.getByText('納甲六爻盤').closest('details')!
    details.open = true
    fireEvent(details, new Event('toggle'))
    expect(await screen.findByText(/納甲六爻盤載入失敗/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '重新整理' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '該讀哪一段' })).toBeTruthy()
  })
})
