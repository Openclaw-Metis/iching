// 每天提醒：選時間後下載 .ics，由行事曆負責提醒（網站沒有推播）。選的時間存進設定，備份時一起帶走。
// 匯入 .ics 不順時，另提供直接開 Google 日曆新增事件的連結。

import { useEffect, useId, useState } from 'react'
import { toast } from '../../app/toast.ts'
import { track } from '../../lib/events.ts'
import { settings } from '../../storage/index.ts'
import { downloadFile } from '../backup/index.ts'
import { buildIcs, googleCalendarUrl, ICS_FILE_NAME } from './ics.ts'

export function IcsReminder() {
  const [time, setTime] = useState(settings.SETTING_DEFAULTS.reminderTime)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const id = useId()

  useEffect(() => {
    let alive = true
    settings.get('reminderTime').then(t => { if (alive && t) setTime(t) }, () => {})
    return () => { alive = false }
  }, [])

  const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(time)

  const download = () => {
    const ics = buildIcs({ time })
    void settings.set('reminderTime', time).catch(() => {})
    try {
      downloadFile(ics, ICS_FILE_NAME, 'text/calendar;charset=utf-8')
      setFailedUrl(null)
      track('daily_ics_download', { time })
      toast('已下載行事曆檔，用手機或電腦的行事曆開啟即可加入')
    } catch {
      // 有些瀏覽器擋自動下載；留一個連結讓使用者長按另存
      setFailedUrl(URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })))
    }
  }

  return (
    <section className="ics-reminder">
      <h2>每天提醒我</h2>
      <p className="note">下載行事曆檔，行事曆會在每天這個時間提醒你回來翻今日卦。</p>
      <div className="ics-row">
        <label htmlFor={id}>提醒時間</label>
        <input id={id} type="time" value={time} onChange={e => setTime(e.target.value)} required />
        <button type="button" className="btn" disabled={!valid} onClick={download}>下載行事曆檔</button>
      </div>
      {valid && (
        <p className="note">
          匯入不順利時，也可以<a href={googleCalendarUrl({ time })} target="_blank" rel="noopener noreferrer">直接加到 Google 日曆</a>。
        </p>
      )}
      {failedUrl && (
        <p className="note" role="alert">
          無法下載，請長按<a href={failedUrl} download={ICS_FILE_NAME}>這個連結</a>另存。
        </p>
      )}
    </section>
  )
}
