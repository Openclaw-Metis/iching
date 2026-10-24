// 手動輸入：使用者自己擲三枚銅錢，點選幾枚是正面。換算同三錢法（正面 3、背面 2），
// 0 枚正面為 6（老陰），依此類推到 3 枚正面為 9（老陽）。

import type { LineValue } from '../../lib/castLines.ts'

export function manualLine(heads: number): LineValue {
  if (!Number.isInteger(heads) || heads < 0 || heads > 3) throw new RangeError(`正面數只能是 0 到 3：${heads}`)
  return (6 + heads) as LineValue
}
