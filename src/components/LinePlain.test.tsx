import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LinesData } from '../data/lines.ts'

const loadLines = vi.fn<() => Promise<LinesData>>()
vi.mock('../data/lines.ts', () => ({ loadLines: () => loadLines() }))

const { LinePlain } = await import('./LinePlain.tsx')

const DATA: LinesData = { '3-1': { plain: '屯六二的白話', advice: '屯六二的提醒' } }

beforeEach(() => loadLines.mockReset())
afterEach(cleanup)

describe('LinePlain', () => {
  it('預設顯示白話與占得提醒，載入完成後通知外層', async () => {
    loadLines.mockResolvedValue(DATA)
    const settled = vi.fn()
    render(<LinePlain entryKey="3-1" label="屯六二" onSettled={settled} />)
    expect(await screen.findByText('屯六二的白話')).toBeTruthy()
    expect(screen.getByText('屯六二的提醒')).toBeTruthy()
    // onSettled 在 effect 裡呼叫，可能比文字出現晚一點
    await waitFor(() => expect(settled).toHaveBeenCalledTimes(1))
  })

  it('預設收合時不載入，切到白話才載入；切回原文就隱藏', async () => {
    loadLines.mockResolvedValue(DATA)
    render(<LinePlain entryKey="3-1" label="屯六二" initial="original" />)
    expect(loadLines).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '白話' }))
    expect(await screen.findByText('屯六二的白話')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '原文' }))
    expect(screen.queryByText('屯六二的白話')).toBeNull()
    expect(screen.getByRole('button', { name: '原文' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('載入失敗時提示先看原文，重試後顯示白話', async () => {
    loadLines.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(DATA)
    render(<LinePlain entryKey="3-1" label="屯六二" />)
    expect(await screen.findByText(/白話載入失敗，先顯示原文/)).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '重試' })))
    expect(await screen.findByText('屯六二的白話')).toBeTruthy()
    expect(loadLines).toHaveBeenCalledTimes(2)
  })

  it('lines.json 沒有這一條時只顯示原文', async () => {
    loadLines.mockResolvedValue({})
    render(<LinePlain entryKey="9-0" label="小畜初九" />)
    expect(await screen.findByText('這段還沒有白話，先以原文為準。')).toBeTruthy()
  })
})
