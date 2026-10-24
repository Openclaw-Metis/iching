import { describe, expect, it } from 'vitest'
import classic from './classic.json'
import { changed, cuo, hexagram, hexagrams, hu, lineLabel, zong } from './hexagrams.ts'

describe('六十四卦結構', () => {
  it('文王卦序 1–64 各出現一次，且每卦六爻不同', () => {
    expect(hexagrams.map(h => h.number)).toEqual(Array.from({ length: 64 }, (_, i) => i + 1))
    expect(new Set(hexagrams.map(h => h.lines.join(''))).size).toBe(64)
  })

  it('文王卦序兩兩相綜，只有四對是相錯', () => {
    const cuoPairs: number[] = []
    for (let n = 1; n <= 63; n += 2) {
      const a = hexagram(n), b = hexagram(n + 1)
      if (zong(a) === b && zong(a) !== a) continue
      expect(cuo(a)).toBe(b)
      cuoPairs.push(n)
    }
    expect(cuoPairs).toEqual([1, 27, 29, 61])
  })

  it('卦名全稱與原文一致的幾個抽樣', () => {
    expect(hexagram(1).fullName).toBe('乾為天')
    expect(hexagram(3).fullName).toBe('水雷屯')
    expect(hexagram(11).fullName).toBe('地天泰')
    expect(hexagram(64).fullName).toBe('火水未濟')
  })

  it('卦名與原文標題的卦名相符', () => {
    for (const h of hexagrams) {
      const judgment = classic.hexagrams[h.number - 1].judgment
      // 坎卦卦辭以「習坎」起首
      expect(judgment.replace(/^習/, '').startsWith(h.name)).toBe(true)
    }
  })

  it('爻題與原文一致', () => {
    for (const h of hexagrams) {
      const labels = classic.hexagrams[h.number - 1].lines.slice(0, 6).map(l => l.label)
      expect(h.lines.map((b, i) => lineLabel(i, b))).toEqual(labels)
    }
  })

  it('互卦、之卦', () => {
    expect(hu(hexagram(1))).toBe(hexagram(1))
    expect(hu(hexagram(3)).name).toBe('剝')
    expect(changed(hexagram(1), [0]).name).toBe('姤')
    expect(changed(hexagram(2), [0, 1, 2, 3, 4, 5]).name).toBe('乾')
  })

  it('京房八宮：每宮八卦、歸魂與遊魂的抽樣', () => {
    const counts = new Map<string, number>()
    for (const h of hexagrams) counts.set(h.palace.trigram.name, (counts.get(h.palace.trigram.name) ?? 0) + 1)
    expect([...counts.values()]).toEqual(Array(8).fill(8))
    expect(hexagram(35).palace).toMatchObject({ generation: '遊魂', shi: 4, ying: 1 })
    expect(hexagram(35).palace.trigram.name).toBe('乾')
    expect(hexagram(14).palace.generation).toBe('歸魂')
    expect(hexagram(44).palace).toMatchObject({ generation: '一世', shi: 1, ying: 4 })
  })

  it('先天次序：乾一、夬二、坤六十四', () => {
    expect(hexagram(1).fuxi).toBe(1)
    expect(hexagram(43).fuxi).toBe(2)
    expect(hexagram(11).fuxi).toBe(8)
    expect(hexagram(2).fuxi).toBe(64)
  })
})
