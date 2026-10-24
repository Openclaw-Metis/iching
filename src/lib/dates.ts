// 「今天」一律依裝置的本地日期計算，各模組都從這裡取日期鍵，跨午夜時結果才會一致。
// 日期鍵格式為 YYYY-MM-DD；天數差以曆日計算，不受夏令時間的 23 或 25 小時影響。

const pad = (n: number) => String(n).padStart(2, '0')

export const localDateKey = (date: Date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

export function isDateKey(s: unknown): s is string {
  if (typeof s !== 'string') return false
  const m = DATE_KEY.exec(s)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}

function dayNumber(key: string): number {
  if (!isDateKey(key)) throw new RangeError(`不是日期鍵：${key}`)
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

/** b 比 a 晚幾天（同一天為 0，b 較早為負數） */
export const daysBetween = (a: string, b: string) => dayNumber(b) - dayNumber(a)

export function addDays(key: string, days: number): string {
  const t = new Date((dayNumber(key) + days) * 86_400_000)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}
