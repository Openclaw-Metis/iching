// 站內使用說明要和規格非技術版的「限制與注意事項」「常見問題」一致：規格改了這裡就會失敗。

import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { FLAGS } from './flags.ts'
import { UserGuide } from './UserGuide.tsx'

const savedFlags = { ...FLAGS }
afterEach(() => {
  cleanup()
  Object.assign(FLAGS, savedFlags)
})

// happy-dom 環境的 import.meta.url 不是 file:，改以專案根目錄（vitest 的工作目錄）為準
const spec = readFileSync('docs/spec.md', 'utf8')

function section(heading: string) {
  const start = spec.indexOf(`### ${heading}`)
  expect(start).toBeGreaterThan(-1)
  const end = spec.indexOf('\n#', start + heading.length + 4)
  return spec.slice(start, end)
}

/** 規格的粗體與引號只是排版，比對時去掉 */
const plain = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, '')

describe('使用說明', () => {
  it('限制與注意事項每一條都在站內說明裡（功能開關全開時）', () => {
    Object.assign(FLAGS, { review: true, collection: true, reminder: true })
    const { container } = render(<UserGuide />)
    const text = plain(container.textContent ?? '')
    const items = section('限制與注意事項').split('\n').filter(l => l.startsWith('- ')).map(l => plain(l.slice(2)).replace('：', ''))
    expect(items.length).toBe(10)
    for (const item of items) expect(text.replace(/：/g, '')).toContain(item)
  })

  it('常見問題每一列的問與答都在站內說明裡（功能開關全開時）', () => {
    Object.assign(FLAGS, { review: true, collection: true, reminder: true })
    const { container } = render(<UserGuide />)
    const text = plain(container.textContent ?? '')
    const rows = section('常見問題與錯誤提示').split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| 問題'))
    expect(rows.length).toBe(10)
    for (const row of rows) {
      const [q, a] = row.split('|').slice(1, 3).map(plain)
      expect(text).toContain(q)
      expect(text).toContain(a)
    }
  })

  it('溫故關閉時不顯示「學習地圖」的問答，其他問答照常', () => {
    FLAGS.review = false
    const { container } = render(<UserGuide />)
    const text = container.textContent ?? ''
    expect(text).not.toContain('學習地圖')
    expect(container.querySelectorAll('.guide-faq dt')).toHaveLength(9)
  })

  it('每日提醒關閉時不顯示「每日提醒靠行事曆」，其他條目照常', () => {
    FLAGS.reminder = false
    const { container } = render(<UserGuide />)
    expect(container.textContent).not.toContain('每日提醒靠行事曆')
    expect(container.querySelectorAll('.guide-list li')).toHaveLength(9)
  })
})
