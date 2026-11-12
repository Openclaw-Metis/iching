// 三層驗證（規格「納甲六爻盤：驗證」）：原文卦例、64 卦窮舉性質、帶日期的整合。
// 卦例取自維基文庫《增刪卜易》（月破章、飛伏神章）附的排盤，預期值照原文逐爻抄錄，由上爻寫到初爻。
import { describe, expect, it } from 'vitest'
import { hexagram, hexagrams } from '../data/hexagrams.ts'
import { BRANCHES, STEMS, branchElement, ganzhiIndex } from './ganzhi.ts'
import { najia, yaoGanzhi, type NajiaChart, type NajiaYao, type Relation } from './najia.ts'

const byName = (name: string) => hexagrams.find(h => h.name === name)!
const text = (y: NajiaYao) => `${y.relation}${BRANCHES[y.branch]}${y.element}`
/** 由上爻到初爻，世應標在後面，和原文的寫法一致 */
const primaryRows = (c: NajiaChart) => [...c.lines].reverse().map(l => `${text(l)}${l.shi ? '世' : l.ying ? '應' : ''}`)
const changedRows = (c: NajiaChart) => [...c.lines].reverse().map(l => (l.changed ? text(l.changed) : ''))
const day = (name: string) => ganzhiIndex(STEMS.indexOf(name[0]), BRANCHES.indexOf(name[1]))
const month = (name: string) => BRANCHES.indexOf(name)

describe('原文卦例：《增刪卜易》', () => {
  it('亥月己丑日，兌化訟：官逢月破，世遇旬空', () => {
    const c = najia(byName('兌'), [0, 5], { month: month('亥'), day: day('己丑') })
    expect(c.result.name).toBe('訟')
    expect(primaryRows(c)).toEqual(['父母未土世', '兄弟酉金', '子孫亥水', '父母丑土應', '妻財卯木', '官鬼巳火'])
    expect(changedRows(c)).toEqual(['父母戌土', '', '', '', '', '妻財寅木'])
    expect(c.lines[0].monthBreak).toBe(true)
    expect(c.lines[5].void).toBe(true)
    // 原文：「空者猶月日辰相沖」，世爻未土被丑日沖
    expect(c.lines[5].dayClash).toBe(true)
  })

  it('辰月戊子日，乾之夬：父母持世，破而化空，朱雀臨父', () => {
    const c = najia(byName('乾'), [5], { month: month('辰'), day: day('戊子') })
    expect(c.result.name).toBe('夬')
    expect(primaryRows(c)).toEqual(['父母戌土世', '兄弟申金', '官鬼午火', '父母辰土應', '妻財寅木', '子孫子水'])
    expect(changedRows(c)).toEqual(['父母未土', '', '', '', '', ''])
    expect(c.lines[5].monthBreak).toBe(true)
    expect(c.lines[5].changed?.void).toBe(true)
    expect(c.lines[5].spirit).toBe('朱雀')
  })

  it('午月癸卯日，艮之觀：之卦的六親仍依本卦的宮', () => {
    const c = najia(byName('艮'), [2, 4], { month: month('午'), day: day('癸卯') })
    expect(c.result.name).toBe('觀')
    expect(primaryRows(c)).toEqual(['官鬼寅木世', '妻財子水', '兄弟戌土', '子孫申金應', '父母午火', '兄弟辰土'])
    expect(changedRows(c)).toEqual(['', '父母巳火', '', '官鬼卯木', '', ''])
    // 子水與午月相沖
    expect(c.lines[4].monthBreak).toBe(true)
    // 觀卦自己屬乾宮（金），若誤用之卦的宮，巳火會變成官鬼
    expect(c.result.palace.trigram.name).toBe('乾')
  })

  it('寅月丙辰日，地澤臨（靜卦）', () => {
    const c = najia(byName('臨'), [], { month: month('寅'), day: day('丙辰') })
    expect(primaryRows(c)).toEqual(['子孫酉金', '妻財亥水應', '兄弟丑土', '兄弟丑土', '官鬼卯木世', '父母巳火'])
    expect(c.lines.every(l => !l.changed && !l.moving)).toBe(true)
    expect(c.missing).toEqual([])
  })

  it('天風姤缺妻財：寅木伏於二爻亥水之下', () => {
    const c = najia(byName('姤'))
    expect(primaryRows(c)).toEqual(['父母戌土', '兄弟申金', '官鬼午火應', '兄弟酉金', '子孫亥水', '父母丑土世'])
    expect(c.missing).toEqual(['妻財'])
    expect(c.lines.map(l => (l.hidden ? text(l.hidden) : ''))).toEqual(['', '妻財寅木', '', '', '', ''])
    expect(text(c.lines[1])).toBe('子孫亥水')
    // 本宮首卦乾為天
    expect(primaryRows(najia(byName('乾')))).toEqual(['父母戌土世', '兄弟申金', '官鬼午火', '父母辰土應', '妻財寅木', '子孫子水'])
  })

  it('酉月丙辰日，地風升：午火子孫伏於丑土之下，丑土旬空', () => {
    const c = najia(byName('升'), [], { month: month('酉'), day: day('丙辰') })
    expect(primaryRows(c)).toEqual(['官鬼酉金', '父母亥水', '妻財丑土世', '官鬼酉金', '父母亥水', '妻財丑土應'])
    expect(c.missing).toEqual(['兄弟', '子孫'])
    expect(text(c.lines[3].hidden!)).toBe('子孫午火')
    expect(c.lines[3].void).toBe(true)
    expect(c.voidBranches?.map(b => BRANCHES[b]).join('')).toBe('子丑')
  })
})

describe('64 卦窮舉', () => {
  const charts = hexagrams.map(h => najia(h))
  const pureOf = (c: NajiaChart) => najia(hexagrams.find(h => h.upper === c.palace && h.lower === c.palace)!)

  it('八純卦的納干支（渾天甲子）', () => {
    const pure = (name: string) => najia(byName(name)).lines.map(yaoGanzhi).join(' ')
    expect(pure('乾')).toBe('甲子 甲寅 甲辰 壬午 壬申 壬戌')
    expect(pure('坤')).toBe('乙未 乙巳 乙卯 癸丑 癸亥 癸酉')
    expect(pure('震')).toBe('庚子 庚寅 庚辰 庚午 庚申 庚戌')
    expect(pure('巽')).toBe('辛丑 辛亥 辛酉 辛未 辛巳 辛卯')
    expect(pure('坎')).toBe('戊寅 戊辰 戊午 戊申 戊戌 戊子')
    expect(pure('離')).toBe('己卯 己丑 己亥 己酉 己未 己巳')
    expect(pure('艮')).toBe('丙辰 丙午 丙申 丙戌 丙子 丙寅')
    expect(pure('兌')).toBe('丁巳 丁卯 丁丑 丁亥 丁酉 丁未')
  })

  it('每一卦的內外卦各自照八純卦納干支，干支陰陽相配', () => {
    for (const c of charts) {
      const lower = najia(hexagrams.find(h => h.upper === c.primary.lower && h.lower === c.primary.lower)!)
      const upper = najia(hexagrams.find(h => h.upper === c.primary.upper && h.lower === c.primary.upper)!)
      expect(c.lines.map(yaoGanzhi)).toEqual([...lower.lines.slice(0, 3), ...upper.lines.slice(3)].map(yaoGanzhi))
      for (const l of c.lines) {
        expect(() => ganzhiIndex(l.stem, l.branch)).not.toThrow()
        expect(l.element).toBe(branchElement(l.branch))
      }
    }
  })

  it('陽卦地支順行、陰卦逆行，各隔一位', () => {
    for (const name of ['乾', '震', '坎', '艮', '坤', '巽', '離', '兌']) {
      const c = najia(byName(name))
      const step = '乾震坎艮'.includes(name) ? 2 : 10
      for (let i = 1; i < 6; i++) expect((c.lines[i - 1].branch + step) % 12, name).toBe(c.lines[i].branch)
    }
  })

  it('世應各一爻，相隔三位，和卦象資料一致', () => {
    for (const c of charts) {
      const shi = c.lines.filter(l => l.shi)
      const ying = c.lines.filter(l => l.ying)
      expect([shi.length, ying.length]).toEqual([1, 1])
      expect(Math.abs(shi[0].position - ying[0].position)).toBe(3)
      expect(shi[0].position).toBe(c.primary.palace.shi - 1)
    }
  })

  it('八純卦六親俱全；缺的六親都有伏神，伏神來自本宮首卦的同一爻位', () => {
    const all: Relation[] = ['兄弟', '子孫', '妻財', '官鬼', '父母']
    for (const c of charts) {
      const own = new Set(c.lines.map(l => l.relation))
      const hidden = c.lines.flatMap(l => (l.hidden ? [l.hidden.relation] : []))
      if (c.primary.palace.generation === '本宮') expect(c.missing, c.primary.name).toEqual([])
      expect(all.filter(r => !own.has(r)), c.primary.name).toEqual(c.missing)
      expect([...new Set(hidden)].sort()).toEqual([...c.missing].sort())
      const pure = pureOf(c)
      for (const l of c.lines) {
        if (l.hidden) expect(yaoGanzhi(l.hidden)).toBe(yaoGanzhi(pure.lines[l.position]))
      }
    }
  })

  it('64 卦 × 64 種變爻：變爻才有變出的爻，干支與之卦相同', () => {
    for (const h of hexagrams) {
      for (let mask = 0; mask < 64; mask++) {
        const moving = [0, 1, 2, 3, 4, 5].filter(i => mask & (1 << i))
        const c = najia(h, moving)
        const result = najia(c.result)
        for (const l of c.lines) {
          expect(Boolean(l.changed)).toBe(moving.includes(l.position))
          if (l.changed) expect(yaoGanzhi(l.changed)).toBe(yaoGanzhi(result.lines[l.position]))
        }
      }
    }
  })
})

describe('月建與日辰', () => {
  it('沒給時不出現六神、旬空、月破、日沖', () => {
    const c = najia(hexagram(1), [0])
    expect(c.voidBranches).toBeUndefined()
    for (const l of c.lines) {
      expect(l.spirit).toBeUndefined()
      expect('void' in l || 'monthBreak' in l || 'dayClash' in l).toBe(false)
    }
  })

  it('六神依日干由初爻起', () => {
    const spirits = (stem: string) => najia(hexagram(1), [], { month: 0, day: day(`${stem}${'甲丙戊庚壬'.includes(stem) ? '子' : '丑'}`) }).lines.map(l => l.spirit)
    expect('甲乙丙丁戊己庚辛壬癸'.split('').map(s => spirits(s)[0])).toEqual(['青龍', '青龍', '朱雀', '朱雀', '勾陳', '螣蛇', '白虎', '白虎', '玄武', '玄武'])
    expect(spirits('甲')).toEqual(['青龍', '朱雀', '勾陳', '螣蛇', '白虎', '玄武'])
    expect(spirits('己')).toEqual(['螣蛇', '白虎', '玄武', '青龍', '朱雀', '勾陳'])
  })

  it('變爻位置不合法時丟出 RangeError', () => {
    expect(() => najia(hexagram(1), [6])).toThrow(RangeError)
  })
})
