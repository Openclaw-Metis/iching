// 由六個爻值組出解讀：本卦、之卦、變爻與朱熹讀法。讀法一律沿用 src/lib/reading.ts 的 interpret()，不另寫一套。

import type { Hexagram } from '../../data/hexagrams.ts'
import { hexagramsOf, type LineValue } from '../../lib/castLines.ts'
import { interpret, type Reading as Interpretation } from '../../lib/reading.ts'

export interface BuiltReading {
  primary: Hexagram
  result: Hexagram
  moving: number[]
  reading: Interpretation
}

export function buildReading(lines: readonly LineValue[]): BuiltReading {
  const { primary, moving } = hexagramsOf(lines)
  const reading = interpret(primary, moving)
  return { primary, result: reading.result, moving: reading.moving, reading }
}
