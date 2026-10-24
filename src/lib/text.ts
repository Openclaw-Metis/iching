// 引文比對用的正規化。句中標點一律視為同一個斷點：允許逗號、句號互換，但斷句位置須與原文一致，
// 不能把「視履，考祥其旋」寫成「視履考祥」。原文 Markdown 裡的 `*` 與跳脫用的反斜線也一併去除。

export const normalizeQuote = (s: string) => s.replace(/[\s「」『』*\\]/g, '').replace(/[，。、；：？！]+/g, '|')

/** 把一段「」引文拆成可以各自比對的片段：刪節號前後分開，頭尾的斷點去掉 */
export const quoteParts = (quote: string) =>
  quote.split(/…+/).map(p => normalizeQuote(p).replace(/^\||\|$/g, '')).filter(Boolean)

/** 找出文字中「」引文不在原文裡的那些（原文須先經 normalizeQuote） */
export function missingQuotes(text: string, corpus: string): string[] {
  const missing: string[] = []
  for (const [, quote] of text.matchAll(/「([^」]+)」/g)) {
    if (quoteParts(quote).some(part => !corpus.includes(part))) missing.push(quote)
  }
  return missing
}
