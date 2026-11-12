// 把納甲盤轉成可以複製的純文字（規格「納甲六爻盤：複製排盤」）。本站不產生解讀，只把已排好的盤面寫成文字；
// 給 AI 的提問是固定的一段話，經 Codex 與 agy 檢視（docs/content-review.md）。

import { BRANCHES, ganzhiName } from '../../lib/ganzhi.ts'
import { yaoGanzhi, type NajiaChart, type NajiaTime, type NajiaYao } from '../../lib/najia.ts'

export interface ChartTextOptions {
  /** 月建與日辰的來源：依起卦時間換算時填畫面上的時間字串，自行指定時留空 */
  castAtLabel?: string
  /** 附上占卜的問題 */
  question?: string
  /** 附上給 AI 的提問 */
  withPrompt?: boolean
}

const ORDINAL = ['初', '二', '三', '四', '五', '上']

const PROMPT_HEAD = '請以熟悉六爻納甲筮法（《增刪卜易》《卜筮正宗》一系）的研習者身分，依下面的排盤解讀。'
const PROMPT_RULES = [
  '直接使用下面已排好的盤：不要重新起卦，不要依時間重算月建與日辰，也不要重排或補造卦名、干支、六親、六神、世應、伏神與空破沖的標記（變爻與伏神的六親都依本卦的宮）。發現資料缺漏或矛盾時指出位置並問我，不要自行改盤。',
  '開始之前：如果下面沒有「問題：」這一行，請先問我想問什麼事，等我回答再解讀。問題不足以決定用神時（例如自占還是代占、問的是誰、問多久之內），只追問會影響取用神的事，不要自行假設。',
  '依所問的事說明取哪一爻為用神、為什麼；同一種六親不只一爻時說明取哪一爻。本卦六爻不見用神時，說明是否以月建、日辰為用，或取盤內所列的伏神，並看飛神與伏神的生剋；不要把伏神和變爻混為一談。',
  '依月建與日辰判斷用神、世爻、應爻與動爻的旺衰，說明元神、忌神對用神的生剋。動爻與它的變爻看回頭生剋、沖合、進退神、化空化破；變爻只對自己那一爻的動爻起作用，不要拿去生剋其他爻。',
  '旬空、月破、日沖只是盤面上的條件，要配合旺衰與動靜判斷，不要見到就直接斷凶。日沖只表示和日支相沖，是暗動還是日破請說明依據。',
  '每個判斷都寫出依據（哪一爻、和誰是什麼關係）。看不出來或條件不足的地方直接說不確定，不要硬湊結論。談應期時只依傳統法則（出空、逢值、逢合、逢沖等）提出有條件的參考，不要指定確切的日期。',
  '最後用白話整理重點。語氣平實，不要鐵口直斷，也不要保證未來；我把這當作整理思緒的參考。',
]

const marks = (yao: NajiaYao) => [yao.void && '旬空', yao.monthBreak && '月破', yao.dayClash && '日沖'].filter(Boolean).join('、')
const yaoText = (yao: NajiaYao) => `${yao.relation}${yaoGanzhi(yao)}${yao.element}${marks(yao) ? `（${marks(yao)}）` : ''}`

export function chartText(chart: NajiaChart, time: NajiaTime, options: ChartTextOptions = {}): string {
  const { primary, result, palace } = chart
  const question = options.question?.trim()
  const generation = primary.palace.generation === '本宮' ? '首卦' : `${primary.palace.generation}卦`
  const out: string[] = []

  if (options.withPrompt) {
    out.push(PROMPT_HEAD)
    PROMPT_RULES.forEach((rule, i) => out.push(`${i + 1}. ${rule}`))
    out.push('')
  }
  out.push('【納甲六爻排盤】')
  if (question) out.push(`問題：${question}`)
  out.push(`本卦：${primary.fullName}（${palace.name}宮${generation}，宮五行${palace.element}）`)
  out.push(result === primary ? '之卦：無（六爻皆不變）' : `之卦：${result.fullName}`)
  out.push(`月建：${BRANCHES[time.month]}月　日辰：${ganzhiName(time.day)}日　旬空：${(chart.voidBranches ?? []).map(b => BRANCHES[b]).join('')}`)
  out.push(options.castAtLabel ? `（依起卦時間 ${options.castAtLabel} 換算；月建依節氣，晚上 11 點後算次日）` : '（月建與日辰為自行指定）')
  if (chart.missing.length) out.push(`本卦六爻不見${chart.missing.join('、')}；伏神取自本宮首卦${palace.name}為${palace.image}`)
  out.push('六爻由上爻到初爻：')
  for (const line of [...chart.lines].reverse()) {
    // 世應緊跟爻位、動靜緊跟陰陽，欄位順序固定；伏神寫明伏在本爻之下，免得被讀成跟著變爻
    const parts = [
      `${ORDINAL[line.position]}爻${line.shi ? '（世）' : line.ying ? '（應）' : ''}`,
      line.spirit ?? '',
      `${line.bit ? '陽' : '陰'}${line.moving ? '動' : '靜'}`,
      yaoText(line),
      line.changed ? `變爻：${yaoText(line.changed)}` : '',
      line.hidden ? `伏神：${yaoText(line.hidden)}，伏在本爻之下` : '',
    ]
    out.push(parts.filter(Boolean).join('　'))
  }
  out.push('說明：世、應指本卦的爻位；變爻與伏神的六親都依本卦的宮；旬空、月破、日沖各屬它所附的那一爻；日沖只標出與日辰相沖，是暗動還是日破沒有判斷。')
  out.push('排盤出自易經卦殿（京房納甲）。')
  return out.join('\n')
}
