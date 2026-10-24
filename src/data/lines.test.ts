import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { textOf } from './classic.ts'
import { hexagrams } from './hexagrams.ts'
import { interpret, type ReadingFocus } from '../lib/reading.ts'
import { missingQuotes, normalizeQuote } from '../lib/text.ts'
import data from './lines.json'
import { keyOf, parseTextFocus, type LinesData } from './lines.ts'

const lines = data as LinesData
const source = readFileSync(new URL('../../易經_周易_原文.md', import.meta.url), 'utf8')
const corpus = normalizeQuote(source)
const len = (s: string) => [...s].length

function originalOf(focus: ReadingFocus): string | undefined {
  const t = textOf(focus.hexagram.number)
  if (focus.kind === 'judgment') return t.judgment
  return t.lines[focus.kind === 'useAll' ? 6 : focus.position]?.text
}

// 卦辭判語與白話裡可算作說明的寫法（docs/lines-review.md「判語不漏譯」）；長的在前
const GOOD = /亨通|通達|順暢|通暢|暢通/
const UPRIGHT = /守正|正道|正固|貞固|持正/
const VERDICTS: [string, RegExp][] = [
  ['不利有攸往', /(不宜|不利|不適合)[^。；]{0,8}(前往|前進|前行|進取|行動|推進)/],
  ['不利涉大川', /(不宜|不利|不適合)[^。；]{0,8}(大河|大川|渡|冒險|大事)/],
  ['利有攸往', /前往|前進|前行|進取|行動|有所作為|推進/],
  ['利涉大川', /大河|大川|渡過|涉險|艱難的大事|承擔大事|迎難|冒險/],
  ['利見大人', /大人|賢者|有德|中正的人/],
  ['元亨', GOOD],
  ['元吉', /大吉|吉/],
  ['利貞', UPRIGHT],
  ['貞吉', UPRIGHT],
  ['悔亡', /悔恨[^。；]{0,4}(消|沒有)|悔亡/],
  ['无攸利', /沒有[^。；]{0,6}(利|好處)|無所利|不利/],
  ['无咎', /沒有過失|無咎|沒有咎|無過失|沒有災|不會有過失|沒有過錯|免於過失/],
  ['亨', GOOD],
  ['吉', /吉/],
  ['凶', /凶/],
  ['厲', /危/],
  ['吝', /遺憾|吝|羞/],
]

const EXPECTED = hexagrams.flatMap(h => [
  `${h.number}-judgment`,
  ...[0, 1, 2, 3, 4, 5].map(p => `${h.number}-${p}`),
  ...(h.number <= 2 ? [`${h.number}-use`] : []),
])

describe('卦辭與爻辭白話（AC-13）', () => {
  it('450 條齊全：384 爻、用九用六、64 條卦辭', () => {
    expect(EXPECTED).toHaveLength(450)
    expect(Object.keys(lines).sort()).toEqual([...EXPECTED].sort())
  })

  it('白話 60 到 140 字、占得提醒 40 到 90 字', () => {
    const problems: string[] = []
    for (const [key, { plain, advice }] of Object.entries(lines)) {
      if (len(plain) < 60 || len(plain) > 140) problems.push(`${key} 白話 ${len(plain)}`)
      if (len(advice) < 40 || len(advice) > 90) problems.push(`${key} 提醒 ${len(advice)}`)
    }
    expect(problems).toEqual([])
  })

  it('「」引文都出自原文，斷句位置一致', () => {
    const missing: string[] = []
    for (const [key, { plain, advice }] of Object.entries(lines)) {
      for (const text of [plain, advice]) for (const q of missingQuotes(text, corpus)) missing.push(`${key}：「${q}」`)
    }
    expect(missing).toEqual([])
  })

  it('不使用破折號', () => {
    const dashes = Object.entries(lines).filter(([, v]) => /[—–]|――/.test(v.plain + v.advice)).map(([k]) => k)
    expect(dashes).toEqual([])
  })

  it('卦辭的判語在白話裡有說明，不只放在引文裡', () => {
    const missing: string[] = []
    for (const h of hexagrams) {
      // 先比對較長的判語並從原文抹掉，「元亨」不再算一次「亨」，「不利有攸往」不再算成「利有攸往」
      let rest = textOf(h.number).judgment
      const plain = lines[`${h.number}-judgment`].plain.replace(/「[^」]*」/g, '')
      for (const [verdict, explained] of VERDICTS) {
        if (!rest.includes(verdict)) continue
        rest = rest.split(verdict).join('＿')
        if (!explained.test(plain)) missing.push(`${h.number} ${h.name}：${verdict}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('64 × 64 種變爻組合的主讀與輔讀都找得到原文與白話（AC-05）', () => {
    const missing = new Set<string>()
    const mainKinds = new Set<string>()
    for (const h of hexagrams) {
      for (let mask = 0; mask < 64; mask++) {
        const moving = [0, 1, 2, 3, 4, 5].filter(i => mask & (1 << i))
        const { focus } = interpret(h, moving)
        mainKinds.add(focus[0].kind)
        for (const f of focus) {
          if (!lines[keyOf(f)]) missing.add(keyOf(f))
          if (!originalOf(f)) missing.add(`${keyOf(f)} 原文`)
        }
      }
    }
    expect([...missing]).toEqual([])
    // 主讀三種情況都要實際出現過，才算分別驗證
    expect([...mainKinds].sort()).toEqual(['judgment', 'line', 'useAll'])
  })
})

describe('卡牌頁經文深層連結', () => {
  it('line 用零起算的原始索引，line-2 是第三爻', () => {
    expect(parseTextFocus('line-2', 3)).toBe('line-2')
    expect(parseTextFocus('line-0', 64)).toBe('line-0')
    expect(parseTextFocus('line-5', 64)).toBe('line-5')
    expect(parseTextFocus('line-6', 1)).toBeNull()
    expect(parseTextFocus('line-02', 3)).toBeNull()
  })

  it('use 只限乾坤，其他卦只切分頁', () => {
    expect(parseTextFocus('use', 1)).toBe('use')
    expect(parseTextFocus('use', 2)).toBe('use')
    expect(parseTextFocus('use', 3)).toBeNull()
  })

  it('卦辭與大象有效，其他值不合法', () => {
    expect(parseTextFocus('judgment', 5)).toBe('judgment')
    expect(parseTextFocus('daxiang', 5)).toBe('daxiang')
    expect(parseTextFocus('tuan', 5)).toBeNull()
    expect(parseTextFocus(null, 5)).toBeNull()
  })
})
