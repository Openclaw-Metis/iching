import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, isDateKey, localDateKey } from './dates.ts'

describe('本地日期', () => {
  it('23:59:59 與隔日 00:00:00 的日期鍵不同（TC-06）', () => {
    const night = new Date(2026, 9, 24, 23, 59, 59)
    const midnight = new Date(2026, 9, 25, 0, 0, 0)
    expect(localDateKey(night)).toBe('2026-10-24')
    expect(localDateKey(midnight)).toBe('2026-10-25')
  })

  it('跨月與跨年的天數差', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
    expect(daysBetween('2026-10-24', '2026-10-24')).toBe(0)
    expect(daysBetween('2026-10-25', '2026-10-24')).toBe(-1)
  })

  it('addDays 跨月、跨年', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29')
  })

  it('isDateKey 拒絕不存在的日期', () => {
    expect(isDateKey('2026-02-29')).toBe(false)
    expect(isDateKey('2026-13-01')).toBe(false)
    expect(isDateKey('2026-1-1')).toBe(false)
    expect(isDateKey('2024-02-29')).toBe(true)
  })
})
