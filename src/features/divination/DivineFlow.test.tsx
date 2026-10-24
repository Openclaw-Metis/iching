// 占卜頁的元件測試：TC-16、TC-17、AC-06、AC-08、AC-09 與 Gherkin「起卦中斷後接續」「重複提問提醒」，
// 以及邊界情境（連點擲爻、問題超長、HTML 文字）。保存層用 fake-indexeddb，畫面用 happy-dom。

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { draft, openStorage, provideStorage, readings, requireDb } from '../../storage/index.ts'
import { DivineFlow } from './DivineFlow.tsx'

let factory: IDBFactory
beforeEach(async () => {
  // 白話以 fetch 載入；元件測試不連網，讓它直接失敗（畫面改顯示原文）
  vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')))
  factory = new IDBFactory()
  provideStorage(await openStorage({ indexedDB: factory, IDBKeyRange }))
  sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const mount = () => render(<MemoryRouter><DivineFlow /></MemoryRouter>)
const castButton = () => screen.findByRole('button', { name: /擲第 \d 爻/ })

async function ask(question: string) {
  const input = await screen.findByRole('textbox')
  fireEvent.change(input, { target: { value: question } })
  fireEvent.click(screen.getByRole('button', { name: '開始起卦' }))
}

/** 擲 n 爻；每爻按下後按鈕冷卻約 300 ms */
async function castAll(n: number) {
  for (let i = 0; i < n; i++) {
    await waitFor(async () => expect(((await castButton()) as HTMLButtonElement).disabled).toBe(false), { timeout: 2000 })
    fireEvent.click(await castButton())
  }
}

describe('占卜頁（TC-17）', () => {
  it('三錢法走完：步驟依序前進，六爻完成後存入紀錄、主操作變成寫下筆記', async () => {
    mount()
    await ask('要不要接下新的專案？')
    await screen.findByText(/擲第 1 爻/)
    await castAll(6)
    await screen.findByText('已存入紀錄', {}, { timeout: 3000 })
    expect(screen.getByRole('button', { name: '寫下筆記' })).toBeTruthy()
    const db = await requireDb()
    expect(await db.readings.count()).toBe(1)
    expect(await draft.get()).toBeUndefined()
  })

  it('連點擲爻按鈕只會成一爻', async () => {
    mount()
    await ask('連點測試的問題')
    const b = await castButton()
    fireEvent.click(b)
    fireEvent.click(b)
    fireEvent.click(b)
    await waitFor(async () => expect((await draft.get())?.lines).toHaveLength(1))
    await new Promise(r => setTimeout(r, 400))
    expect((await draft.get())?.lines).toHaveLength(1)
  })
})

describe('起卦中斷後接續（AC-06、Gherkin）', () => {
  it('擲了 3 爻後重新進入，看到接續提示，接續後前 3 爻不變，紀錄列表第一筆是這次占卜', async () => {
    const first = mount()
    await ask('要不要接下新的專案？')
    await castAll(3)
    await waitFor(async () => expect((await draft.get())?.lines).toHaveLength(3))
    const before = (await draft.get())!.lines
    first.unmount()

    mount()
    await screen.findByText('接續上次的起卦（已完成 3 爻）')
    fireEvent.click(screen.getByRole('button', { name: '接續' }))
    await castAll(3)
    await screen.findByText('已存入紀錄', {}, { timeout: 3000 })
    const db = await requireDb()
    const list = await readings.queryList(db, {}, {})
    expect(list.items[0].question).toBe('要不要接下新的專案？')
    expect(list.items[0].lines.slice(0, 3)).toEqual(before)
  })
})

describe('重複提問提醒（AC-08、Gherkin）', () => {
  it('24 小時內問同一件事時提醒，選擇仍要起卦後進入起卦步驟', async () => {
    const db = await requireDb()
    const hourAgo = new Date(Date.now() - 3600_000).toISOString()
    await db.readings.add({
      id: 'old', createdAt: hourAgo, updatedAt: hourAgo, rev: 1, question: '要不要搬家？', category: 'general', method: 'coins',
      lines: [7, 7, 7, 8, 8, 8], primary: 11, result: 11, moving: [], note: '', followUp: null, starred: 0, v: 1, deletedAt: null,
    })
    mount()
    await ask('  要不要搬家？ ')
    await screen.findByText(/初筮告，再三瀆，瀆則不告/)
    // happy-dom 的 <dialog> 不在無障礙樹裡，改以文字找按鈕
    fireEvent.click(screen.getByText('仍要起卦'))
    await screen.findByText(/擲第 1 爻/)
  })
})

describe('問題的邊界', () => {
  it('輸入框限 200 字，到上限時顯示「問題最多 200 字」；HTML 一律以文字呈現', async () => {
    mount()
    const input = await screen.findByRole('textbox') as HTMLTextAreaElement
    expect(input.maxLength).toBe(200)
    fireEvent.change(input, { target: { value: '問'.repeat(200) } })
    await screen.findByText('問題最多 200 字。')
    expect(screen.getByText('200／200')).toBeTruthy()
    fireEvent.change(input, { target: { value: '<b>粗體</b><script>alert(1)</script>' } })
    fireEvent.click(screen.getByRole('button', { name: '開始起卦' }))
    await castAll(6)
    await screen.findByText('已存入紀錄', {}, { timeout: 3000 })
    expect(document.querySelector('b')?.textContent).not.toBe('粗體')
    expect(document.body.textContent).toContain('<b>粗體</b>')
  })
})

describe('保存失敗（TC-16、AC-09）', () => {
  // 以替換資料表方法的方式模擬空間不足（瀏覽器實測另以攔截 IDBObjectStore 驗證過）
  it('起卦途中寫入失敗：提示進度暫時無法保存，仍可繼續', async () => {
    mount()
    await ask('寫入失敗的測試')
    const db = await requireDb()
    const original = db.castDraft.put.bind(db.castDraft)
    db.castDraft.put = (() => Promise.reject(Object.assign(new Error('空間不足'), { name: 'QuotaExceededError' }))) as unknown as typeof db.castDraft.put
    await castAll(1)
    await screen.findByText(/進度暫時無法保存/)
    db.castDraft.put = original
    await castAll(1)
    await waitFor(() => expect(screen.queryByText(/進度暫時無法保存/)).toBeNull(), { timeout: 3000 })
  })

  it('六爻完成時保存失敗：解讀照常顯示，主操作變成下載這次結果', async () => {
    mount()
    await ask('完成時保存失敗的測試')
    const db = await requireDb()
    db.readings.add = (() => Promise.reject(Object.assign(new Error('空間不足'), { name: 'QuotaExceededError' }))) as unknown as typeof db.readings.add
    await castAll(6)
    await screen.findByRole('button', { name: '下載這次結果' }, { timeout: 3000 })
    expect(screen.getByText(/裝置空間不足/)).toBeTruthy()
    expect(document.querySelector('.focus-block.main')).toBeTruthy()
  })
})
