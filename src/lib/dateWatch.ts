// 跨日檢查（規格「通知與背景執行」）：頁面可見時每 60 秒、回到前景時比對本地日期，換日才通知。
// 頁面隱藏時停掉計時器，不在背景空轉。

import { localDateKey } from './dates.ts'

type VisibilitySource = Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>

export interface DateWatchOptions {
  now?: () => Date
  interval?: number
  /** 測試時注入 */
  doc?: VisibilitySource
}

/** 回傳停止函式 */
export function watchDate(onChange: (date: string) => void, { now = () => new Date(), interval = 60_000, doc = document }: DateWatchOptions = {}): () => void {
  let last = localDateKey(now())
  let timer: ReturnType<typeof setInterval> | undefined
  const check = () => {
    const date = localDateKey(now())
    if (date === last) return
    last = date
    onChange(date)
  }
  const start = () => { timer ??= setInterval(check, interval) }
  const stop = () => {
    clearInterval(timer)
    timer = undefined
  }
  const onVisibility = () => {
    if (doc.hidden) return stop()
    check()
    start()
  }
  doc.addEventListener('visibilitychange', onVisibility)
  if (!doc.hidden) start()
  return () => {
    stop()
    doc.removeEventListener('visibilitychange', onVisibility)
  }
}
