// 親手分蓍的進度：每一變由使用者選左堆根數，程式完成掛一、揲四、歸奇，三變成一爻，十八變成一卦。
// 進度存在起卦草稿的 yarrow 欄位（第幾爻、第幾變、本變開始時的根數），重新整理後從同一變繼續。

import type { LineValue } from '../../lib/castLines.ts'
import type { CastDraft } from '../../storage/index.ts'
import { YARROW_TOTAL, yarrowChange, yarrowValue, type YarrowChange } from './yarrow.ts'

export interface HandState {
  /** 正在成的爻，0 為初爻 */
  line: number
  /** 這一爻的第幾變，0 到 2 */
  change: number
  /** 本變開始時的根數 */
  remaining: number
}

export const TOTAL_STEPS = 18

export const handStart = (line = 0): HandState => ({ line, change: 0, remaining: YARROW_TOTAL })

/** 第幾步（1 到 18） */
export const stepNumber = (state: HandState) => state.line * 3 + state.change + 1

export interface HandStep {
  change: YarrowChange
  /** 三變完成時的爻值 */
  value?: LineValue
  /** 下一變的狀態；第六爻完成後為 null */
  next: HandState | null
}

export function stepHand(state: HandState, left: number): HandStep {
  const change = yarrowChange(state.remaining, left)
  if (state.change < 2) return { change, next: { line: state.line, change: state.change + 1, remaining: change.remaining } }
  const value = yarrowValue(change.remaining)
  return { change, value, next: state.line < 5 ? handStart(state.line + 1) : null }
}

/** 草稿往前一變：記下這一變的進度，三變完成時把爻加進 lines；第六爻完成時草稿變成 complete */
export function applySplit(draft: CastDraft, left: number): { draft: CastDraft; step: HandStep } {
  const state = draft.yarrow ?? handStart(draft.lines.length)
  const step = stepHand(state, left)
  const lines = step.value === undefined ? draft.lines : [...draft.lines, step.value]
  return { step, draft: { ...draft, lines, yarrow: step.next, phase: lines.length === 6 ? 'complete' : draft.phase } }
}
