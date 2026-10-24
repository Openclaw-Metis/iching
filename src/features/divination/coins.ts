// 三錢法：三枚銅錢同時擲，正面算 3、背面算 2，三枚相加得 6 到 9。
// 老陰、老陽各 1/8，少陽、少陰各 3/8。

import type { LineValue } from '../../lib/castLines.ts'
import { cryptoSource, randomInt, type Uint32Source } from '../../lib/rng.ts'

export type Coin = 2 | 3

export interface CoinLine {
  value: LineValue
  coins: [Coin, Coin, Coin]
}

export function castCoinLine(source: Uint32Source = cryptoSource): CoinLine {
  const coins = [0, 1, 2].map(() => randomInt(2, 3, source)) as [Coin, Coin, Coin]
  return { value: (coins[0] + coins[1] + coins[2]) as LineValue, coins }
}
