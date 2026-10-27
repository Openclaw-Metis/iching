// 直排經文的分欄：固定字數一欄，由右而左排。仿古籍的禁則，句讀與後引號不落在欄首（併入上一欄，
// 那一欄因此多一兩字），前引號不留在欄尾（移到下一欄開頭）。

const NO_START = new Set([...'，。、；：？！」』）〉》…'])
const NO_END = new Set([...'「『（〈《'])

export function splitColumns(text: string, perColumn: number): string[] {
  if (!Number.isInteger(perColumn) || perColumn < 2) throw new RangeError(`每欄字數至少 2：${perColumn}`)
  const chars = [...text.trim()]
  const columns: string[][] = []
  let current: string[] = []
  for (const ch of chars) {
    if (current.length >= perColumn && !NO_START.has(ch)) {
      // 欄尾若是前引號，連同它一起換到下一欄
      const carry: string[] = []
      while (current.length > 1 && NO_END.has(current.at(-1)!)) carry.unshift(current.pop()!)
      columns.push(current)
      current = carry
    }
    current.push(ch)
  }
  if (current.length) columns.push(current)
  return columns.map(c => c.join(''))
}

/** 依目標欄數決定每欄字數，限制在 min 到 max 之間：短的經文排成兩三欄，不會只剩細長一欄 */
export function balancedPerColumn(text: string, columns: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.ceil([...text.trim()].length / columns)))
}
