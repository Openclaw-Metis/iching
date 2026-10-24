import { describe, expect, it } from 'vitest'
import { buildIcs, googleCalendarUrl, ICS_UID } from './ics.ts'

const URL_TODAY = 'https://openclaw-metis.github.io/iching/today'
const NOW = new Date(2026, 9, 24, 15, 20)

// 依 RFC 5545 還原折行
const unfold = (ics: string) => ics.replace(/\r\n /g, '')

describe('buildIcs（AC-12）', () => {
  const ics = buildIcs({ time: '07:30', url: URL_TODAY, now: NOW })
  const lines = unfold(ics).split('\r\n')

  it('每天重複、在選定的當地時間提醒、附網站連結', () => {
    expect(lines).toContain('RRULE:FREQ=DAILY')
    expect(lines).toContain('DTSTART:20261024T073000')
    expect(lines).toContain(`URL:${URL_TODAY}`)
    expect(lines.find(l => l.startsWith('DESCRIPTION:翻開'))).toContain(URL_TODAY)
    const alarm = lines.slice(lines.indexOf('BEGIN:VALARM'), lines.indexOf('END:VALARM') + 1)
    expect(alarm).toEqual(['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:易經卦殿：翻開今日一卦', 'TRIGGER:PT0M', 'END:VALARM'])
  })

  it('UID 固定、DTSTART 不帶時區、結構完整', () => {
    expect(lines).toContain(`UID:${ICS_UID}`)
    expect(lines.find(l => l.startsWith('DTSTART'))).not.toMatch(/Z$|TZID/)
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines.at(-2)).toBe('END:VCALENDAR')
    expect(lines).toContain('VERSION:2.0')
    expect(lines.find(l => l.startsWith('DTSTAMP:'))).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/)
  })

  it('以 CRLF 分行，每行不超過 75 個位元組且不從字中間切開', () => {
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n')
    const encoder = new TextEncoder()
    for (const line of ics.split('\r\n')) expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    expect(ics).not.toContain('�')
  })

  it('時間格式不對時拋錯', () => {
    expect(() => buildIcs({ time: '7:30', url: URL_TODAY })).toThrow(RangeError)
    expect(() => buildIcs({ time: '24:00', url: URL_TODAY })).toThrow(RangeError)
  })
})

describe('googleCalendarUrl', () => {
  it('跨午夜的結束時間落在隔天', () => {
    const url = new URL(googleCalendarUrl({ time: '23:55', url: URL_TODAY, now: NOW }))
    expect(url.searchParams.get('dates')).toBe('20261024T235500/20261025T000500')
    expect(url.searchParams.get('recur')).toBe('RRULE:FREQ=DAILY')
  })
})
