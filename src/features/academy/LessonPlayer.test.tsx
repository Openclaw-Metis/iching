// 課程頁的元件測試（TC-18、AC-14 的「送出前不顯示對錯」）：read 步驟顯示「繼續」；
// quiz 步驟未選答案時「檢查」停用，檢查後才出現解說；考核逐題作答不揭露。

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openStorage, provideStorage } from '../../storage/index.ts'
import { ExamPlayer, LessonPlayer } from './LessonPlayer.tsx'

beforeEach(async () => provideStorage(await openStorage({ indexedDB: new IDBFactory(), IDBKeyRange })))
afterEach(cleanup)

const primary = () => document.querySelector<HTMLButtonElement>('.player-actions .btn-primary')!

describe('課程頁（TC-18）', () => {
  it('read 步驟顯示「繼續」；quiz 步驟未選答案時「檢查」停用，選了才可按，檢查後顯示解說與下一步', async () => {
    render(<MemoryRouter><LessonPlayer lessonId="S1-L2" /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: '開始' }))
    await waitFor(() => expect(primary().textContent).toBe('繼續'))
    // S1-L2 前兩步是閱讀
    for (let i = 0; i < 2; i++) {
      await waitFor(() => expect(primary().disabled).toBe(false))
      expect(primary().textContent).toBe('繼續')
      fireEvent.click(primary())
      await waitFor(() => expect(primary().textContent).not.toBe(''))
    }
    await waitFor(() => expect(primary().textContent).toBe('檢查'))
    expect(primary().disabled).toBe(true)
    expect(document.querySelector('.q-explain')).toBeNull()
    fireEvent.click(document.querySelector('.q-option input')!)
    await waitFor(() => expect(primary().disabled).toBe(false))
    fireEvent.click(primary())
    await screen.findByRole('status')
    expect(document.querySelector('.q-explain')).toBeTruthy()
    await waitFor(() => expect(primary().textContent).toBe('下一步'))
  })
})

describe('考核頁（AC-14）', () => {
  it('逐題作答時不顯示對錯與解說', async () => {
    render(<MemoryRouter><ExamPlayer stationId={1} /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: '開始考核' }))
    for (let i = 0; i < 3; i++) {
      await screen.findByText(`第 ${i + 1} 題／共 10 題`)
      expect(primary().textContent).toBe('下一題')
      expect(primary().disabled).toBe(true)
      fireEvent.click(document.querySelector('.q-option input')!)
      expect(document.querySelector('.q-explain')).toBeNull()
      expect(document.querySelector('[data-state]')).toBeNull()
      await waitFor(() => expect(primary().disabled).toBe(false))
      fireEvent.click(primary())
    }
    await screen.findByText('第 4 題／共 10 題')
  })
})
