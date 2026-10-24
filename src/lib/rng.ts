// 起卦與抽牌用的均勻亂數。一律用 crypto.getRandomValues，並以拒絕取樣避免 `% n` 的取模偏差。

/** 回傳 [0, 2^32) 的均勻整數；測試可注入固定序列 */
export type Uint32Source = () => number

export const cryptoSource: Uint32Source = () => crypto.getRandomValues(new Uint32Array(1))[0]

const RANGE = 2 ** 32

/** [min, max] 的均勻整數（含兩端） */
export function randomInt(min: number, max: number, source: Uint32Source = cryptoSource): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) throw new RangeError(`範圍不合法：${min} 到 ${max}`)
  const span = max - min + 1
  if (span > RANGE) throw new RangeError('範圍超過 2^32')
  // 只接受落在 span 整數倍以內的值，超出的部分丟掉重抽，每個餘數的機率才會相等
  const limit = RANGE - (RANGE % span)
  for (;;) {
    const x = source()
    if (x < limit) return min + (x % span)
  }
}

export const randomBit = (source: Uint32Source = cryptoSource): 0 | 1 => randomInt(0, 1, source) as 0 | 1

/** 由固定序列組成的亂數來源，用完就從頭循環；測試用 */
export function sequenceSource(values: number[]): Uint32Source {
  let i = 0
  return () => values[i++ % values.length]
}
