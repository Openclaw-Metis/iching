// 干支與節氣月建的換算（規格「納甲六爻盤：月建與日辰」）。天干、地支一律用序號：甲為 0、子為 0；六十甲子序 0 為甲子。
// 排盤引擎（najia.ts）只收月建地支與日干支，這裡負責把時間換成那兩個值。

export const STEMS = '甲乙丙丁戊己庚辛壬癸'
export const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'

export type Element = '金' | '木' | '水' | '火' | '土'

const BRANCH_ELEMENTS: Element[] = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水']
export const branchElement = (branch: number): Element => BRANCH_ELEMENTS[branch]

const mod = (n: number, m: number) => ((n % m) + m) % m

/** 天干與地支合成六十甲子序；陰陽不同的組合（如甲丑）不存在 */
export function ganzhiIndex(stem: number, branch: number): number {
  if ((stem - branch) % 2 !== 0) throw new RangeError(`沒有這個干支：${STEMS[stem]}${BRANCHES[branch]}`)
  return mod(6 * stem - 5 * branch, 60)
}

export const ganzhiName = (index: number) => `${STEMS[index % 10]}${BRANCHES[index % 12]}`

/** 相沖的地支：子午、丑未、寅申、卯酉、辰戌、巳亥 */
export const clashOf = (branch: number) => (branch + 6) % 12

/** 旬空：日辰所在一旬沒有配到的兩個地支 */
export function voidBranches(day: number): [number, number] {
  const first = mod(day % 12 - day % 10 + 10, 12)
  return [first, (first + 1) % 12]
}

// 1970-01-01 是辛巳日（六十甲子序 17）
const EPOCH_DAY = 17

/** 西曆日期的日干支（六十甲子序） */
export function dayGanzhi(year: number, month: number, day: number): number {
  return mod(Math.round(Date.UTC(year, month - 1, day) / 86_400_000) + EPOCH_DAY, 60)
}

const rad = (deg: number) => (deg * Math.PI) / 180

/**
 * 太陽視黃經（度，0 到 360）。Meeus《Astronomical Algorithms》第 25 章的低精度公式，誤差約 0.01 度，
 * 換成時間約 15 分鐘，所以交節前後要另外提示（見 castTime 的 nearTerm）。
 */
export function solarLongitude(epochMs: number): number {
  // 力學時與世界時的差近年約 70 秒，遠小於公式本身的誤差，取定值
  const jde = epochMs / 86_400_000 + 2440587.5 + 70 / 86_400
  const t = (jde - 2451545) / 36525
  const mean = 280.46646 + 36000.76983 * t + 0.0003032 * t * t
  const anomaly = rad(357.52911 + 35999.05029 * t - 0.0001537 * t * t)
  const center = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(anomaly)
    + (0.019993 - 0.000101 * t) * Math.sin(2 * anomaly)
    + 0.000289 * Math.sin(3 * anomaly)
  const omega = rad(125.04 - 1934.136 * t)
  return mod(mean + center - 0.00569 - 0.00478 * Math.sin(omega), 360)
}

// 太陽每小時約走 0.041 度；離交節不到一小時就提示
const NEAR_TERM_DEGREES = 0.041

/** 月建地支：依節氣的「節」換月，立春（黃經 315 度）起為寅月，每 30 度換一個月 */
export function monthBranch(epochMs: number): { branch: number; nearTerm: boolean } {
  const fromLichun = mod(solarLongitude(epochMs) - 315, 360)
  const within = fromLichun % 30
  return { branch: (Math.floor(fromLichun / 30) + 2) % 12, nearTerm: Math.min(within, 30 - within) < NEAR_TERM_DEGREES }
}

export interface CastTime {
  /** 月建地支 */
  month: number
  /** 日辰（六十甲子序） */
  day: number
  /** 起卦時刻離交節不到一小時，月建可能差一個月 */
  nearTerm: boolean
}

/** 起卦時刻的月建與日辰。日辰依裝置的本地日期，晚上 11 點起算次日（子時換日）；月建由時刻算，和時區無關 */
export function castTime(date: Date): CastTime {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate() + (date.getHours() >= 23 ? 1 : 0))
  const { branch, nearTerm } = monthBranch(date.getTime())
  return { month: branch, day: dayGanzhi(local.getFullYear(), local.getMonth() + 1, local.getDate()), nearTerm }
}
