// 爻位規則（規格「出題規則」）：初、三、五為陽位，二、四、上為陰位；陽爻居陽位、陰爻居陰位為當位。
// 二、五為中爻。初與四、二與五、三與上為對位，一陰一陽為有應，同陰或同陽為無應。爻位一律 0 起算。

import type { Bit } from '../../../data/trigrams.ts'

/** 陽位：初、三、五（0、2、4） */
export const isYangPosition = (position: number) => position % 2 === 0

export const isProper = (position: number, bit: Bit) => isYangPosition(position) === (bit === 1)

export const isCentral = (position: number) => position === 1 || position === 4

/** 對位：初與四、二與五、三與上 */
export const counterpart = (position: number) => (position + 3) % 6

export const isResonant = (lines: readonly Bit[], position: number) => lines[position] !== lines[counterpart(position)]
