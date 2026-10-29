// 換頁焦點（規格「2026-10-29 介面檢視後修訂」）：點卦牌進到卡牌頁時焦點移到新頁的 h1 並念出頁名；
// 按返回回到卦殿時，焦點還給剛才點的那張卦牌。

import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { useRouteFocus } from './routeFocus.ts'

afterEach(cleanup)

function Shell({ children }: { children: ReactNode }) {
  const announce = useRouteFocus()
  const navigate = useNavigate()
  return (
    <>
      <header className="site-header"><button type="button" onClick={() => void navigate(-1)}>返回</button></header>
      <main>{children}</main>
      <p data-testid="announce">{announce}</p>
    </>
  )
}

function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<><h1>卦殿</h1><Link to="/gua/2">坤</Link><Link to="/gua/1">乾</Link></>} />
        <Route path="/gua/:n" element={<h1>卡牌</h1>} />
      </Routes>
    </Shell>
  )
}

describe('換頁焦點', () => {
  it('進入新頁時焦點在 h1 並念出頁名；返回時焦點回到原本點的連結', async () => {
    render(<MemoryRouter><App /></MemoryRouter>)
    fireEvent.click(screen.getByRole('link', { name: '乾' }))
    await waitFor(() => expect(document.activeElement?.textContent).toBe('卡牌'))
    expect(document.activeElement?.tagName).toBe('H1')
    expect(screen.getByTestId('announce').textContent).toBe('已開啟：乾・乾為天')

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '返回' })) })
    await waitFor(() => expect(document.activeElement?.getAttribute('href')).toBe('/gua/1'))
    expect(screen.getByTestId('announce').textContent).toBe('已開啟：易經卦殿')
  })
})
