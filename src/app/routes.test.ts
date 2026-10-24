import { describe, expect, it } from 'vitest'
import { PATTERNS, routeFor, routes, titleFor } from './routes.ts'

describe('路徑表', () => {
  it('共 102 條：5 個主頁面、64 張卡牌頁、24 課、8 場考核、溫故', () => {
    expect(routes).toHaveLength(102)
    const count = (page: string) => routes.filter(r => r.page === page).length
    expect(count('card')).toBe(64)
    expect(count('lesson')).toBe(24)
    expect(count('exam')).toBe(8)
    expect(count('review')).toBe(1)
    expect(['hall', 'today', 'divine', 'academy', 'me'].map(count)).toEqual([1, 1, 1, 1, 1])
  })

  it('路徑不重複，且都對得上路由樣式', () => {
    expect(new Set(routes.map(r => r.path)).size).toBe(routes.length)
    for (const r of routes) {
      const pattern = new RegExp(`^${PATTERNS[r.page].replace(/:[a-z]+/g, '[^/]+')}$`)
      expect(r.path).toMatch(pattern)
    }
  })

  it('標題', () => {
    expect(titleFor('/gua/3')).toBe('屯・水雷屯｜易經卦殿')
    expect(titleFor('/gua/3/')).toBe('屯・水雷屯｜易經卦殿')
    expect(titleFor('/academy/lesson/S2-L1')).toBe('八卦卦畫・第二站｜易經卦殿')
    expect(titleFor('/academy/exam/8')).toBe('第八站考核・占法｜易經卦殿')
    expect(routeFor('/gua/65')).toBeUndefined()
  })
})
