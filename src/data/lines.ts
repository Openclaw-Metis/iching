// 卦辭與爻辭的白話與占得提醒（規格「爻辭與卦辭白話內容規格」）：384 爻、用九用六與 64 條卦辭共 450 條。
// 鍵為「卦序-judgment」「卦序-爻位」（爻位 0 到 5，初爻為 0）與「1-use」「2-use」。
// lines.json 建置成獨立的雜湊檔，只在需要時以 fetch 載入，不進卦殿首屏。
// 不用 import()：瀏覽器會記住載入失敗的動態模組，同一頁面再 import 也不會重新請求，重試就無效。

import type { ReadingFocus } from '../lib/reading.ts'
import linesUrl from './lines.json?url'

export interface LinePlain {
  /** 白話：這一爻或這段卦辭在說什麼 */
  plain: string
  /** 占得提醒：占得時可以怎麼應對 */
  advice: string
}

export type LinesData = Record<string, LinePlain>

/** 經文位置：卦辭、爻（原始索引 0 到 5）或乾坤的用九用六 */
export type LineTarget = { kind: 'judgment' } | { kind: 'line'; position: number } | { kind: 'useAll' }

export function lineKey(hexagram: number, target: LineTarget): string {
  if (target.kind === 'judgment') return `${hexagram}-judgment`
  if (target.kind === 'useAll') return `${hexagram}-use`
  return `${hexagram}-${target.position}`
}

/** 解讀的 focus 對應到哪一條白話 */
export const keyOf = (focus: ReadingFocus) => lineKey(focus.hexagram.number, focus)

/**
 * 卡牌頁經文分頁的深層連結目標 ?tab=text&focus=；line 用原始索引（初爻為 0，line-2 是第三爻）。
 * 放在這裡而不是 routes.ts，因為 routes.ts 在卦殿首屏，而用到它的頁面都已經會載入這個模組。
 */
export type TextFocus = 'judgment' | 'daxiang' | 'use' | `line-${0 | 1 | 2 | 3 | 4 | 5}`

/** 不合法的目標（含乾坤以外的 use）回傳 null，頁面只切分頁不捲動 */
export function parseTextFocus(raw: string | null, hexagram: number): TextFocus | null {
  if (raw === 'judgment' || raw === 'daxiang') return raw
  if (raw === 'use') return hexagram <= 2 ? raw : null
  return raw !== null && /^line-[0-5]$/.test(raw) ? (raw as TextFocus) : null
}

let cache: Promise<LinesData> | null = null

/** 載入並快取；失敗時清掉快取，下次可以重試 */
export function loadLines(): Promise<LinesData> {
  cache ??= fetch(linesUrl).then(res => {
    if (!res.ok) throw new Error(`lines.json ${res.status}`)
    return res.json() as Promise<LinesData>
  })
  cache.catch(() => { cache = null })
  return cache
}
