// 每日提醒的行事曆檔（規格「通知與背景執行」）。網站沒有推播，改由手機或電腦的行事曆每天提醒。
// DTSTART 用不帶時區的當地時間，行事曆會以使用者所在時區解讀；UID 固定，重新下載時多數行事曆視為同一事件。

import { localDateKey } from '../../lib/dates.ts'

export const ICS_UID = 'daily@openclaw-metis.github.io-iching'
export const ICS_FILE_NAME = 'iching-daily.ics'
const SUMMARY = '易經卦殿：翻開今日一卦'

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

/** 今日頁的完整網址；正式站以 VITE_SITE_ORIGIN 為準，沒設定時用目前網域 */
export function todayUrl(): string {
  const origin = import.meta.env.VITE_SITE_ORIGIN || location.origin
  return `${origin.replace(/\/$/, '')}${import.meta.env.BASE_URL}today`
}

const escapeText = (s: string) => s.replace(/[\\;,]/g, m => `\\${m}`).replace(/\r?\n/g, '\\n')

const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

// RFC 5545 每行最多 75 個位元組，續行以一個空白開頭；中文一字 3 位元組，不能從字的中間切開
function fold(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = '', bytes = 0
  for (const ch of line) {
    const size = encoder.encode(ch).length
    const limit = parts.length === 0 ? 75 : 74
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  parts.push(current)
  return parts.join('\r\n ')
}

export interface IcsOptions {
  /** HH:MM */
  time: string
  url?: string
  now?: Date
}

export function buildIcs({ time, url = todayUrl(), now = new Date() }: IcsOptions): string {
  const m = TIME.exec(time)
  if (!m) throw new RangeError(`時間格式應為 HH:MM：${time}`)
  const start = `${localDateKey(now).replace(/-/g, '')}T${m[1]}${m[2]}00`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//openclaw-metis//iching//ZH-TW',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ICS_UID}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${start}`,
    'DURATION:PT10M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${escapeText(SUMMARY)}`,
    `DESCRIPTION:${escapeText(`翻開今天的卦牌，讀一句牌義與今日提醒：${url}`)}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(SUMMARY)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** 匯入 .ics 不順時的替代：直接開 Google 日曆的新增事件頁 */
export function googleCalendarUrl({ time, url = todayUrl(), now = new Date() }: IcsOptions): string {
  const m = TIME.exec(time)
  if (!m) throw new RangeError(`時間格式應為 HH:MM：${time}`)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(m[1]), Number(m[2]))
  const end = new Date(start.getTime() + 10 * 60_000)
  // 不帶 Z 的時間，Google 日曆以使用者的時區解讀，與 .ics 的 DTSTART 一致
  const stamp = (d: Date) => `${localDateKey(d).replace(/-/g, '')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: SUMMARY,
    dates: `${stamp(start)}/${stamp(end)}`,
    recur: 'RRULE:FREQ=DAILY',
    details: `翻開今天的卦牌：${url}`,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}
