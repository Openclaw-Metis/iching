// 變爻以朱紅標示，陰爻（兩段 rect）也要變色：顏色寫在 g 上會被樣式表的 .hexglyph rect 蓋過。

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { HexagramGlyph } from './HexagramGlyph.tsx'

afterEach(cleanup)

describe('卦畫的變爻', () => {
  it('陽爻與陰爻的變爻都把朱紅寫在每個 rect 上，其他爻不寫', () => {
    // 屯：初九、六二、六三、六四、九五、上六
    const { container } = render(<HexagramGlyph lines={[1, 0, 0, 0, 1, 0]} moving={[0, 1, 5]} />)
    const lines = [...container.querySelectorAll('.gl')]
    const fills = lines.map(l => (l.tagName === 'rect' ? [l] : [...l.querySelectorAll('rect')]).map(r => (r as SVGElement).style.fill))
    expect(fills).toEqual([
      ['var(--vermilion)'],
      ['var(--vermilion)', 'var(--vermilion)'],
      ['', ''],
      ['', ''],
      [''],
      ['var(--vermilion)', 'var(--vermilion)'],
    ])
  })
})
