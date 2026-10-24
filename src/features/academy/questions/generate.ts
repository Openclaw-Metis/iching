// 出題器：依卦象資料自動產生 14 種題型（規格「學堂內容設計」與「出題規則」）。
// 正解一律由資料推算（hexagrams、trigrams、textOf、interpret），課程 JSON 只指定題型與範圍。
// 每題帶穩定的 questionKey（題型加參數），10 秒防刷與溫故卡都靠它對應。

import { textOf } from '../../../data/classic.ts'
import { cuo, hexagram, hexagrams, hu, lineLabel, zong, type Hexagram } from '../../../data/hexagrams.ts'
import { trigrams, type Bit, type Trigram } from '../../../data/trigrams.ts'
import { interpret, type ReadingFocus } from '../../../lib/reading.ts'
import { cryptoSource, randomInt, type Uint32Source } from '../../../lib/rng.ts'
import { counterpart, isCentral, isProper, isResonant, isYangPosition } from './positions.ts'
import type { Option, Prompt, Question, QuestionParams, QuestionType } from './types.ts'

// ── 亂數小工具 ───────────────────────────────────────

const pick = <T>(list: readonly T[], src: Uint32Source): T => list[randomInt(0, list.length - 1, src)]

function shuffle<T>(list: readonly T[], src: Uint32Source): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(0, i, src)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** 從 preferred 依序挑，不足再從 rest 隨機補；跳過 label 重複或 skip 的 */
function distractors<T>(count: number, preferred: readonly T[], rest: readonly T[], label: (x: T) => string, taken: Set<string>, src: Uint32Source): T[] {
  const out: T[] = []
  for (const x of [...shuffle(preferred, src), ...shuffle(rest, src)]) {
    if (out.length === count) break
    const l = label(x)
    if (taken.has(l)) continue
    taken.add(l)
    out.push(x)
  }
  if (out.length < count) throw new Error('干擾項不足')
  return out
}

interface Draft {
  type: QuestionType
  key: string
  prompt: Prompt
  correct: Option
  others: Option[]
  explanation: string
  hexagram?: number
  facet?: Question['facet']
  /** 是非題維持固定順序（當位、不當位），不洗牌 */
  fixedOrder?: boolean
}

function finish(d: Draft, src: Uint32Source): Question {
  const options = d.fixedOrder ? [d.correct, ...d.others] : shuffle([d.correct, ...d.others], src)
  if (d.fixedOrder) options.sort((a, b) => (a.order as number) - (b.order as number))
  const q: Question = {
    questionKey: d.key,
    type: d.type,
    prompt: d.prompt,
    options: options.map(({ order: _order, ...o }) => o),
    answerIndex: options.indexOf(d.correct),
    explanation: d.explanation,
  }
  if (d.hexagram !== undefined) q.hexagram = d.hexagram
  if (d.facet) q.facet = d.facet
  return q
}

const nameOption = (h: Hexagram): Option => ({ label: h.name })
const yinYang = (bit: Bit) => (bit ? '陽' : '陰')
const describeGlyph = (lines: readonly Bit[]) => `卦畫由下而上：${lines.map(b => yinYang(b as Bit)).join('')}`
const sharesTrigram = (h: Hexagram) => hexagrams.filter(x => x !== h && (x.upper === h.upper || x.lower === h.lower))

function pool(params: QuestionParams): Hexagram[] {
  const list = params.hexagrams?.length ? params.hexagrams.map(hexagram) : hexagrams
  return list
}

// ── 卦名與卦畫 ───────────────────────────────────────

function glyphToName(p: QuestionParams, src: Uint32Source): Question {
  const h = pick(pool(p), src)
  const taken = new Set([h.name])
  const others = distractors(3, sharesTrigram(h), hexagrams, x => x.name, taken, src).map(nameOption)
  return finish({
    type: 'glyph-to-name', key: `glyph-to-name:${h.number}`, hexagram: h.number, facet: 'glyph',
    prompt: { text: '這是哪一卦？', glyph: [...h.lines] },
    correct: nameOption(h), others,
    explanation: `${h.fullName}：上卦${h.upper.name}（${h.upper.image}），下卦${h.lower.name}（${h.lower.image}）。`,
  }, src)
}

function nameToGlyph(p: QuestionParams, src: Uint32Source): Question {
  const h = pick(pool(p), src)
  const glyphOption = (x: Hexagram): Option => ({ label: describeGlyph(x.lines), glyph: [...x.lines] })
  const taken = new Set([describeGlyph(h.lines)])
  const others = distractors(3, [cuo(h), zong(h), ...sharesTrigram(h)], hexagrams, x => describeGlyph(x.lines), taken, src).map(glyphOption)
  return finish({
    type: 'name-to-glyph', key: `name-to-glyph:${h.number}`, hexagram: h.number,
    prompt: { text: `「${h.name}」卦的卦畫是哪一個？` },
    correct: glyphOption(h), others,
    explanation: `${h.name}是${h.fullName}，上卦${h.upper.name}（${h.upper.image}），下卦${h.lower.name}（${h.lower.image}）。`,
  }, src)
}

function pairToName(p: QuestionParams, src: Uint32Source): Question {
  const h = pick(pool(p), src)
  const swapped = hexagrams.find(x => x.upper === h.lower && x.lower === h.upper)!
  const taken = new Set([h.name])
  const others = distractors(3, [swapped, ...sharesTrigram(h)], hexagrams, x => x.name, taken, src).map(nameOption)
  return finish({
    type: 'pair-to-name', key: `pair-to-name:${h.number}`, hexagram: h.number,
    prompt: { text: `上卦是${h.upper.name}（${h.upper.image}），下卦是${h.lower.name}（${h.lower.image}），合成哪一卦？` },
    correct: nameOption(h), others,
    explanation: `上${h.upper.image}下${h.lower.image}，卦名全稱是「${h.fullName}」。`,
  }, src)
}

function imageToName(p: QuestionParams, src: Uint32Source): Question {
  const h = pick(pool(p), src)
  const taken = new Set([h.name])
  // 一個背景相近（上卦或下卦相同）的干擾項，其餘隨機
  const near = distractors(1, sharesTrigram(h), [], x => x.name, taken, src)
  const others = [...near, ...distractors(2, [], hexagrams, x => x.name, taken, src)].map(nameOption)
  return finish({
    type: 'image-to-name', key: `image-to-name:${h.number}`, hexagram: h.number, facet: 'image',
    prompt: { text: '這張圖是哪一卦？', image: h.number },
    correct: nameOption(h), others,
    explanation: `${h.fullName}：背景上半是${h.upper.image}（${h.upper.name}）的紋樣，下半是${h.lower.image}（${h.lower.name}）的紋樣。`,
  }, src)
}

// ── 八卦 ─────────────────────────────────────────────

const TRIGRAM_VARIANTS = ['glyph-name', 'glyph-image', 'name-image', 'name-nature', 'name-family', 'name-glyph'] as const

function trigramQuestion(p: QuestionParams, src: Uint32Source): Question {
  const variant = (TRIGRAM_VARIANTS as readonly string[]).includes(p.variant ?? '') ? p.variant! : pick(TRIGRAM_VARIANTS, src)
  const t = pick(trigrams, src)
  const field: Record<string, (x: Trigram) => string> = {
    'glyph-name': x => x.name, 'glyph-image': x => x.image, 'name-image': x => x.image,
    'name-nature': x => x.nature, 'name-family': x => x.family, 'name-glyph': x => describeGlyph(x.lines),
  }
  const label = field[variant]
  const option = (x: Trigram): Option => (variant === 'name-glyph' ? { label: label(x), glyph: [...x.lines] } : { label: label(x) })
  const taken = new Set([label(t)])
  const others = distractors(3, [], trigrams, label, taken, src).map(option)
  const text: Record<string, string> = {
    'glyph-name': '這個三畫卦是八卦中的哪一卦？',
    'glyph-image': '這個三畫卦象徵哪一種自然之象？',
    'name-image': `「${t.name}」象徵哪一種自然之象？`,
    'name-nature': `依《說卦》，「${t.name}」的性情是什麼？`,
    'name-family': `依《說卦》的家人之喻，「${t.name}」是誰？`,
    'name-glyph': `「${t.name}」的卦畫是哪一個？`,
  }
  return finish({
    type: 'trigram', key: `trigram:${variant}:${t.id}`,
    prompt: variant.startsWith('glyph') ? { text: text[variant], glyph: [...t.lines] } : { text: text[variant] },
    correct: option(t), others,
    explanation: `${t.name}象${t.image}，性情為「${t.nature}」，在家人之喻中為${t.family}。`,
  }, src)
}

// ── 大象 ─────────────────────────────────────────────

const DAXIANG_PREFIXES = ['君子以', '先王以', '后以', '大人以', '上以']

/** 大象中以「君子以」等開頭的後半句；前半句含卦名，不放進題幹 */
export function daxiangHalf(daxiang: string): string {
  const starts = DAXIANG_PREFIXES.map(p => daxiang.indexOf(p)).filter(i => i >= 0)
  if (!starts.length) throw new Error(`大象沒有可出題的後半句：${daxiang}`)
  return daxiang.slice(Math.min(...starts))
}

function daxiangToName(p: QuestionParams, src: Uint32Source): Question {
  // 正解卦名出現在題幹裡時換一卦
  const eligible = pool(p).filter(h => !daxiangHalf(textOf(h.number).daxiang).includes(h.name))
  const h = pick(eligible.length ? eligible : hexagrams.filter(h => !daxiangHalf(textOf(h.number).daxiang).includes(h.name)), src)
  const half = daxiangHalf(textOf(h.number).daxiang)
  const taken = new Set([h.name])
  // 題幹裡出現的卦名（如頤卦的「節飲食」含「節」）不能當干擾項
  const allowed = hexagrams.filter(x => !half.includes(x.name))
  const others = distractors(3, [], allowed, x => x.name, taken, src).map(nameOption)
  return finish({
    type: 'daxiang-to-name', key: `daxiang-to-name:${h.number}`, hexagram: h.number,
    prompt: { text: `「${half}」出自哪一卦的大象？` },
    correct: nameOption(h), others,
    explanation: `${h.name}卦大象：「${textOf(h.number).daxiang}」`,
  }, src)
}

// ── 錯綜互與卦序 ─────────────────────────────────────

const RELATIONS = {
  cuo: { name: '錯卦', of: cuo, how: '六爻陰陽全變' },
  zong: { name: '綜卦', of: zong, how: '整卦上下顛倒' },
  hu: { name: '互卦', of: hu, how: '取二到四爻為下卦、三到五爻為上卦' },
} as const

function relation(p: QuestionParams, src: Uint32Source): Question {
  const kind = (p.variant && p.variant in RELATIONS ? p.variant : pick(Object.keys(RELATIONS), src)) as keyof typeof RELATIONS
  const h = pick(pool(p), src)
  const r = RELATIONS[kind]
  const answer = r.of(h)
  const taken = new Set([answer.name])
  const others = distractors(3, [cuo(h), zong(h), hu(h), h], hexagrams, x => x.name, taken, src).map(nameOption)
  return finish({
    type: 'relation', key: `relation:${kind}:${h.number}`, hexagram: h.number,
    prompt: { text: `${h.name}的${r.name}是哪一卦？`, glyph: [...h.lines] },
    correct: nameOption(answer), others,
    explanation: `${r.name}是${r.how}。${h.name}的${r.name}是${answer.name}${answer === h ? '（就是自己）' : ''}。`,
  }, src)
}

const SEQUENCE_VARIANTS = ['next', 'prev', 'pair'] as const

function sequence(p: QuestionParams, src: Uint32Source): Question {
  const h = pick(pool(p), src)
  const n = h.number
  let variant = (SEQUENCE_VARIANTS as readonly string[]).includes(p.variant ?? '') ? p.variant! : pick(SEQUENCE_VARIANTS, src)
  if ((variant === 'next' && n === 64) || (variant === 'prev' && n === 1)) variant = 'pair'
  const partnerOf = (k: number) => (k % 2 ? k + 1 : k - 1)
  const answer = hexagram(variant === 'next' ? n + 1 : variant === 'prev' ? n - 1 : partnerOf(n))
  const near = [n - 2, n - 1, n + 1, n + 2, n + 3, n - 3].filter(k => k >= 1 && k <= 64 && k !== n).map(hexagram)
  const taken = new Set([answer.name, h.name])
  const others = distractors(3, near, hexagrams, x => x.name, taken, src).map(nameOption)
  const text = { next: `文王卦序中，${h.name}的下一卦是哪一卦？`, prev: `文王卦序中，${h.name}的前一卦是哪一卦？`, pair: `文王卦序兩兩成對，和${h.name}成對的是哪一卦？` }[variant as 'next' | 'prev' | 'pair']
  const [a, b] = [Math.min(n, answer.number), Math.max(n, answer.number)].map(hexagram)
  const explanation = variant === 'pair'
    ? `第${a.number}卦${a.name}與第${b.number}卦${b.name}成對，${zong(a) === b ? '兩卦互為綜卦（覆）' : '兩卦互為錯卦（變）'}。`
    : `${h.name}是第${n}卦，${variant === 'next' ? '下' : '前'}一卦是第${answer.number}卦${answer.name}。`
  return finish({ type: 'sequence', key: `sequence:${variant}:${n}`, hexagram: n, prompt: { text }, correct: nameOption(answer), others, explanation }, src)
}

// ── 爻 ───────────────────────────────────────────────

function lineOptions(position: number, bit: Bit, src: Uint32Source): { correct: Option; others: Option[] } {
  const correct = lineLabel(position, bit)
  const all = [0, 1, 2, 3, 4, 5].flatMap(p => [lineLabel(p, 1), lineLabel(p, 0)])
  // 優先放同一爻位的另一種陰陽，以及同陰陽的鄰近爻位
  const preferred = [lineLabel(position, (1 - bit) as Bit), ...[position - 1, position + 1].filter(p => p >= 0 && p <= 5).map(p => lineLabel(p, bit))]
  const others = distractors(3, preferred, all, x => x, new Set([correct]), src).map(label => ({ label }))
  return { correct: { label: correct }, others }
}

const ORDINALS = '一二三四五六'

const LINE_RULE = '陽爻稱九、陰爻稱六；最下一爻稱「初」，最上一爻稱「上」，中間以二到五稱呼。'

function lineLabelQuestion(_p: QuestionParams, src: Uint32Source): Question {
  const position = randomInt(0, 5, src)
  const bit = randomInt(0, 1, src) as Bit
  const { correct, others } = lineOptions(position, bit, src)
  return finish({
    type: 'line-label', key: `line-label:${position}:${bit}`,
    prompt: { text: `由下往上數第${ORDINALS[position]}爻，是${yinYang(bit)}爻，這一爻的爻題是？` },
    correct, others,
    explanation: `${LINE_RULE}所以是「${correct.label}」。`,
  }, src)
}

function linePosition(p: QuestionParams, src: Uint32Source): Question {
  const h = pick(pool(p), src)
  const position = randomInt(0, 5, src)
  const bit = h.lines[position]
  const { correct, others } = lineOptions(position, bit, src)
  return finish({
    type: 'line-position', key: `line-position:${h.number}:${position}`, hexagram: h.number,
    prompt: { text: '卦畫中標出的這一爻，爻題是？', glyph: [...h.lines], highlight: position },
    correct, others,
    explanation: `標出的是由下往上第${ORDINALS[position]}爻，是${yinYang(bit)}爻。${LINE_RULE}所以是「${correct.label}」。`,
  }, src)
}

const POSITION_VARIANTS = ['proper', 'central', 'counterpart', 'resonance'] as const

function positionQuestion(p: QuestionParams, src: Uint32Source): Question {
  const variant = (POSITION_VARIANTS as readonly string[]).includes(p.variant ?? '') ? p.variant! : pick(POSITION_VARIANTS, src)
  const h = pick(pool(p), src)
  const position = randomInt(0, 5, src)
  const bit = h.lines[position]
  const label = lineLabel(position, bit)
  const prompt = (text: string): Prompt => ({ text, glyph: [...h.lines], highlight: position })
  const key = `position:${variant}:${h.number}:${position}`
  const base = { type: 'position' as const, key, hexagram: h.number }
  const c = counterpart(position)
  const cLabel = lineLabel(c, h.lines[c])
  const binary = (yes: boolean, yesLabel: string, noLabel: string) => {
    const yesOpt = { label: yesLabel, order: 0 }, noOpt = { label: noLabel, order: 1 }
    return { correct: yes ? yesOpt : noOpt, others: [yes ? noOpt : yesOpt], fixedOrder: true }
  }
  if (variant === 'proper') {
    const proper = isProper(position, bit)
    return finish({
      ...base, prompt: prompt(`標出的${label}是否當位？`), ...binary(proper, '當位', '不當位'),
      explanation: `${label}是${yinYang(bit)}爻，居${isYangPosition(position) ? '陽' : '陰'}位，所以${proper ? '當位' : '不當位'}。陽爻居陽位（初、三、五）、陰爻居陰位（二、四、上）為當位。`,
    }, src)
  }
  if (variant === 'central') {
    const central = isCentral(position)
    return finish({
      ...base, prompt: prompt(`標出的${label}是不是中爻？`), ...binary(central, '是中爻', '不是中爻'),
      explanation: `中爻是下卦正中的二爻與上卦正中的五爻。${label}${central ? '是' : '不是'}中爻。`,
    }, src)
  }
  if (variant === 'resonance') {
    const resonant = isResonant(h.lines, position)
    return finish({
      ...base, prompt: prompt(`標出的${label}與它的應爻${cLabel}，是有應還是無應？`), ...binary(resonant, '有應', '無應'),
      explanation: `對位的兩爻一陰一陽為有應，同陰或同陽為無應。${label}與${cLabel}${resonant ? '一陰一陽，有應' : '同為' + yinYang(bit) + '爻，無應'}。`,
    }, src)
  }
  const others = distractors(3, [], [0, 1, 2, 3, 4, 5].filter(i => i !== position && i !== c), i => lineLabel(i, h.lines[i]), new Set([cLabel]), src)
    .map(i => ({ label: lineLabel(i, h.lines[i]) }))
  return finish({
    ...base, prompt: prompt(`標出的${label}，它的應爻是哪一爻？`), correct: { label: cLabel }, others,
    explanation: `初與四、二與五、三與上為對位，所以${label}的應爻是${cLabel}。`,
  }, src)
}

// ── 經與傳 ───────────────────────────────────────────

const TEXT_KINDS = { judgment: '卦辭', line: '爻辭', tuan: '彖傳', daxiang: '大象', xiang: '小象', wenyan: '文言' } as const
type TextKind = keyof typeof TEXT_KINDS
const TEXT_HELP: Record<TextKind, string> = {
  judgment: '卦辭總說一卦的吉凶。',
  line: '爻辭分說每一爻。',
  tuan: '彖傳解釋卦辭與卦名。',
  daxiang: '大象由上下卦的自然之象，說君子應有的作為。',
  xiang: '小象逐條解釋爻辭。',
  wenyan: '文言只有乾坤兩卦有，進一步闡發卦辭與爻辭。',
}

/** 取第一句；太長時截在逗號，題幹不至於佔滿畫面 */
function excerpt(text: string, max = 40): string {
  const end = text.indexOf('。')
  const first = end >= 0 ? text.slice(0, end + 1) : text
  if ([...first].length <= max) return first
  const cut = first.lastIndexOf('，', max)
  return cut > 0 ? `${first.slice(0, cut)}……` : `${[...first].slice(0, max).join('')}……`
}

function textKind(p: QuestionParams, src: Uint32Source): Question {
  const list = pool(p)
  const kinds = Object.keys(TEXT_KINDS) as TextKind[]
  const kind = (p.variant && p.variant in TEXT_KINDS ? p.variant : pick(kinds, src)) as TextKind
  // 文言只出乾坤
  const h = kind === 'wenyan' ? pick(list.filter(x => x.number <= 2).length ? list.filter(x => x.number <= 2) : [hexagram(1), hexagram(2)], src) : pick(list, src)
  const t = textOf(h.number)
  const index = kind === 'line' || kind === 'xiang' ? randomInt(0, 5, src) : kind === 'wenyan' ? randomInt(0, t.wenyan.length - 1, src) : 0
  const read: Record<TextKind, () => string> = {
    judgment: () => t.judgment, tuan: () => t.tuan, daxiang: () => t.daxiang,
    line: () => t.lines[index].text, xiang: () => t.lines[index].xiang, wenyan: () => t.wenyan[index],
  }
  const source = read[kind]()
  const sentence = excerpt(source)
  const allowed = kinds.filter(k => k !== kind && (k !== 'wenyan' || h.number <= 2))
  const others = distractors(3, [], allowed, k => k, new Set([kind]), src).map(k => ({ label: TEXT_KINDS[k] }))
  const where = kind === 'line' || kind === 'xiang' ? `（${t.lines[index].label}）` : ''
  return finish({
    type: 'text-kind', key: `text-kind:${kind}:${h.number}:${index}`, hexagram: h.number,
    prompt: { text: `「${sentence}」屬於哪一部分？` },
    correct: { label: TEXT_KINDS[kind] }, others,
    explanation: `這句出自${h.name}卦的${TEXT_KINDS[kind]}${where}。${TEXT_HELP[kind]}`,
  }, src)
}

// ── 占法 ─────────────────────────────────────────────

/** 讀法指定經文的名稱，如「屯六二」「未濟卦辭」「乾用九」 */
export function focusLabel(focus: ReadingFocus): string {
  const t = textOf(focus.hexagram.number)
  if (focus.kind === 'judgment') return `${focus.hexagram.name}卦辭`
  if (focus.kind === 'useAll') return `${focus.hexagram.name}${t.lines[6].label}`
  return `${focus.hexagram.name}${t.lines[focus.position].label}`
}

const THREE_CHANGE_NOTE = '本站只取朱熹的大原則（本卦卦辭為主、之卦卦辭為輔），沒有再依「前十卦主貞，後十卦主悔」細分。'

function readingRule(p: QuestionParams, src: Uint32Source): Question {
  // variant 為變爻數（0 到 6）；6 搭配乾坤時讀用九、用六
  const count = /^[0-6]$/.test(p.variant ?? '') ? Number(p.variant) : randomInt(0, 6, src)
  const h = pick(pool(p), src)
  const moving = shuffle([0, 1, 2, 3, 4, 5], src).slice(0, count).sort((a, b) => a - b)
  const r = interpret(h, moving)
  const correct = focusLabel(r.focus[0])
  const t = textOf(h.number), rt = textOf(r.result.number)
  const candidates = [
    `${h.name}卦辭`, `${r.result.name}卦辭`,
    ...moving.map(i => `${h.name}${t.lines[i].label}`),
    ...[0, 1, 2, 3, 4, 5].map(i => `${r.result.name}${rt.lines[i].label}`),
    ...[0, 1, 2, 3, 4, 5].map(i => `${h.name}${t.lines[i].label}`),
  ]
  const others = distractors(3, candidates.slice(0, 2 + moving.length), candidates, x => x, new Set([correct]), src).map(label => ({ label }))
  const desc = count === 0 ? '六爻都不變' : `${moving.map(i => t.lines[i].label).join('、')}${count === 6 ? '六爻全' : ''}變`
  return finish({
    type: 'reading-rule', key: `reading-rule:${h.number}:${moving.join('')}`, hexagram: h.number,
    prompt: { text: `本卦是${h.name}，${desc}（之卦為${r.result.name}）。依朱熹的讀法，主要該讀哪一段？`, glyph: [...h.lines], moving },
    correct: { label: correct }, others,
    explanation: `${r.rule}${count === 3 ? THREE_CHANGE_NOTE : ''}`,
  }, src)
}

interface ProbabilityItem { id: string; text: string; answer: string; others: string[]; explanation: string }

// 三錢法：老陽、老陰各 1/8，少陽、少陰各 3/8。大衍筮法：老陰 1/16、少陽 5/16、少陰 7/16、老陽 3/16
const PROBABILITY_BANK: ProbabilityItem[] = [
  { id: 'coins-old-yang', text: '三錢法中，擲出老陽（九）的機率是多少？', answer: '1/8', others: ['3/8', '1/4', '1/2'], explanation: '三枚都是正面才是老陽，機率 1/2 × 1/2 × 1/2 = 1/8。' },
  { id: 'coins-moving', text: '三錢法中，擲出變爻（老陽或老陰）的機率是多少？', answer: '1/4', others: ['1/8', '3/8', '1/2'], explanation: '老陽與老陰各 1/8，合計 1/4。' },
  { id: 'coins-young', text: '三錢法中，擲出少陰（八）的機率是多少？', answer: '3/8', others: ['1/8', '1/4', '7/16'], explanation: '少陰與少陽各 3/8，老陰與老陽各 1/8。' },
  { id: 'coins-compare', text: '三錢法中，老陽與老陰哪一個比較常出現？', answer: '一樣常出現', others: ['老陽較常出現', '老陰較常出現', '老陰不會出現'], explanation: '三錢法的老陽與老陰都是 1/8，機率相同。' },
  { id: 'yarrow-most', text: '大衍筮法中，哪一種爻最常出現？', answer: '少陰（八）', others: ['少陽（七）', '老陽（九）', '老陰（六）'], explanation: '大衍筮法的機率：老陰 1/16、少陽 5/16、少陰 7/16、老陽 3/16，少陰最常出現。' },
  { id: 'yarrow-old-yin', text: '大衍筮法中，擲出老陰（六）的機率是多少？', answer: '1/16', others: ['1/8', '3/16', '1/4'], explanation: '大衍筮法的老陰只有 1/16，是四種爻中最少見的。' },
  { id: 'yarrow-compare', text: '大衍筮法中，老陽與老陰哪一個比較常出現？', answer: '老陽較常出現', others: ['老陰較常出現', '一樣常出現', '老陽不會出現'], explanation: '大衍筮法的老陽是 3/16，老陰是 1/16，老陽是老陰的三倍。這是和三錢法最大的不同。' },
  { id: 'yarrow-moving', text: '大衍筮法中，出現變爻（老陽或老陰）的機率是多少？', answer: '1/4', others: ['1/16', '3/16', '1/2'], explanation: '老陰 1/16 加老陽 3/16，合計 4/16，也就是 1/4，和三錢法相同。' },
]

function methodProbability(p: QuestionParams, src: Uint32Source): Question {
  const item = PROBABILITY_BANK.find(x => x.id === p.variant) ?? pick(PROBABILITY_BANK, src)
  return finish({
    type: 'method-probability', key: `method-probability:${item.id}`,
    prompt: { text: item.text },
    correct: { label: item.answer }, others: item.others.map(label => ({ label })),
    explanation: item.explanation,
  }, src)
}

const GENERATORS: Record<QuestionType, (p: QuestionParams, src: Uint32Source) => Question> = {
  'glyph-to-name': glyphToName,
  'name-to-glyph': nameToGlyph,
  trigram: trigramQuestion,
  'pair-to-name': pairToName,
  'daxiang-to-name': daxiangToName,
  'image-to-name': imageToName,
  relation,
  'line-label': lineLabelQuestion,
  'line-position': linePosition,
  sequence,
  'text-kind': textKind,
  'reading-rule': readingRule,
  position: positionQuestion,
  'method-probability': methodProbability,
}

export function generateQuestion(type: QuestionType, params: QuestionParams = {}, src: Uint32Source = cryptoSource): Question {
  const gen = GENERATORS[type]
  if (!gen) throw new Error(`沒有這種題型：${type}`)
  return gen(params, src)
}

/** 一次出多題，盡量不重複同一題（questionKey 相同時重抽，最多試 20 次） */
export function generateSet(type: QuestionType, count: number, params: QuestionParams = {}, src: Uint32Source = cryptoSource): Question[] {
  const out: Question[] = []
  const keys = new Set<string>()
  for (let i = 0; i < count; i++) {
    let q = generateQuestion(type, params, src)
    for (let tries = 0; keys.has(q.questionKey) && tries < 20; tries++) q = generateQuestion(type, params, src)
    keys.add(q.questionKey)
    out.push(q)
  }
  return out
}
