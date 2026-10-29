// 課程頁的元件測試（TC-18、AC-14 的「送出前不顯示對錯」）：read 步驟顯示「繼續」；
// quiz 步驟未選答案時「檢查」停用，檢查後才出現解說；考核逐題作答不揭露。

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attempts as attemptsRepo, openStorage, provideStorage, requireDb } from '../../storage/index.ts'
import { ExamPlayer, LessonPlayer } from './LessonPlayer.tsx'

beforeEach(async () => provideStorage(await openStorage({ indexedDB: new IDBFactory(), IDBKeyRange })))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

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

describe('作答鍵盤（規格「2026-10-29 介面檢視後修訂」）', () => {
  it('數字鍵選答、Enter 檢查再到下一步；焦點在按鈕上時不攔截', async () => {
    render(<MemoryRouter><LessonPlayer lessonId="S1-L2" /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: '開始' }))
    await waitFor(() => expect(primary().textContent).toBe('繼續'))
    // S1-L2 前兩步是閱讀；Enter 只在題目時接手
    for (let i = 0; i < 2; i++) {
      await waitFor(() => expect(primary().disabled).toBe(false))
      fireEvent.click(primary())
      await waitFor(() => expect(primary().textContent).not.toBe(''))
    }
    await waitFor(() => expect(primary().textContent).toBe('檢查'))
    // 焦點在按鈕上時，數字鍵不選答
    fireEvent.keyDown(primary(), { key: '1' })
    expect(document.querySelectorAll<HTMLInputElement>('.q-option input')[0].checked).toBe(false)
    fireEvent.keyDown(document.body, { key: '2' })
    await waitFor(() => expect(document.querySelectorAll<HTMLInputElement>('.q-option input')[1].checked).toBe(true))
    fireEvent.keyDown(document.body, { key: 'Enter' })
    await screen.findByRole('status')
    expect(document.querySelector('.q-explain')).toBeTruthy()
    await waitFor(() => expect(primary().textContent).toBe('下一步'))
    // 揭露後不能再改答案
    fireEvent.keyDown(document.body, { key: '1' })
    expect(document.querySelectorAll<HTMLInputElement>('.q-option input')[1].checked).toBe(true)
  })
})

describe('考核頁（AC-14）', () => {
  it('選答保存失敗時保留選擇，按重試後存入且不揭露答案', async () => {
    render(<MemoryRouter><ExamPlayer stationId={1} /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: '開始考核' }))
    await screen.findByText('第 1 題／共 10 題')
    vi.spyOn(attemptsRepo, 'saveAnswer').mockRejectedValueOnce(new Error('temporary write failure'))
    fireEvent.click(document.querySelectorAll('.q-option input')[1])
    await screen.findByRole('alert')
    expect(document.querySelectorAll<HTMLInputElement>('.q-option input')[1].checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '重試' }))
    const db = await requireDb()
    await waitFor(async () => expect((await db.attempts.toArray())[0].answers[0]?.choice).toBe(1))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(document.querySelector('.q-explain')).toBeNull()
  })

  it('考核頁停留跨日後提示重新開始，不會卡在重試舊作答', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 24, 23, 59))
    render(<MemoryRouter><ExamPlayer stationId={1} /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: '開始考核' }))
    await screen.findByText('第 1 題／共 10 題')
    const db = await requireDb()
    const old = (await db.attempts.toArray())[0]
    vi.setSystemTime(new Date(2026, 9, 25, 0, 1))
    fireEvent.click(document.querySelector('.q-option input')!)
    await screen.findByText('這場考核已跨日，請重新開始考核。')
    expect((await db.attempts.get(old.id))?.status).toBe('void')
    fireEvent.click(screen.getByRole('button', { name: '重新開始考核' }))
    fireEvent.click(await screen.findByRole('button', { name: '開始考核' }))
    await screen.findByText('第 1 題／共 10 題')
    const fresh = (await db.attempts.toArray()).find(a => a.status === 'active')!
    expect(fresh.id).not.toBe(old.id)
    expect(fresh.date).toBe('2026-10-25')
  })

  it('選答後尚未按下一題就離開，回來保留同題同選項與選擇', async () => {
    const mount = () => render(<MemoryRouter><ExamPlayer stationId={1} /></MemoryRouter>)
    const first = mount()
    fireEvent.click(await screen.findByRole('button', { name: '開始考核' }))
    await screen.findByText('第 1 題／共 10 題')
    fireEvent.click(document.querySelectorAll('.q-option input')[1])
    const db = await requireDb()
    await waitFor(async () => expect((await db.attempts.toArray())[0].answers[0]?.choice).toBe(1))
    const before = (await db.attempts.toArray())[0]
    first.unmount()
    mount()
    await screen.findByText('第 1 題／共 10 題')
    expect(document.querySelectorAll<HTMLInputElement>('.q-option input')[1].checked).toBe(true)
    expect((await db.attempts.toArray())[0].questions).toEqual(before.questions)
    expect(document.querySelector('.q-explain')).toBeNull()
  })

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
