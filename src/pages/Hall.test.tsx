// 卦殿的搜尋結果（規格「2026-10-29 介面檢視後修訂」）：文王卦序預設只列符合，可切回全部；
// 上下卦的格位有意義，一律變淡而不移除；沒有符合時給清除方式。

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { Hall } from './Hall.tsx'

afterEach(cleanup)

const grid = () => document.querySelectorAll('.hall-grid .thumb')
const search = (q: string) => fireEvent.change(screen.getByRole('searchbox'), { target: { value: q } })

describe('卦殿搜尋結果', () => {
  it('文王卦序只列符合，切到「全部」時 64 卦都在、不符合的變淡', () => {
    render(<MemoryRouter><Hall /></MemoryRouter>)
    expect(grid()).toHaveLength(64)
    search('水')
    const count = Number(screen.getByText(/^符合 \d+ 卦$/).textContent!.match(/\d+/)![0])
    expect(count).toBeGreaterThan(1)
    expect(grid()).toHaveLength(count)
    fireEvent.click(screen.getByRole('button', { name: '全部' }))
    expect(grid()).toHaveLength(64)
    expect(document.querySelectorAll('.hall-grid .thumb[data-dim="true"]')).toHaveLength(64 - count)
  })

  it('上下卦一律保留 64 格；沒有符合時顯示說明，清除搜尋後恢復', () => {
    render(<MemoryRouter><Hall /></MemoryRouter>)
    search('沒有這卦')
    expect(screen.getByText('沒有符合的卦。')).toBeTruthy()
    expect(grid()).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: '上下卦' }))
    expect(screen.queryByText('沒有符合的卦。')).toBeNull()
    expect(document.querySelectorAll('.matrix .thumb')).toHaveLength(64)
    fireEvent.click(screen.getByRole('button', { name: '文王卦序' }))
    fireEvent.click(screen.getByRole('button', { name: '清除搜尋' }))
    expect(grid()).toHaveLength(64)
  })
})
