// 今日一卦。換日時（頁面開著跨過午夜，或隔天從背景切回來）回到牌背，提示可以翻開新的一卦。

import { useEffect, useState } from 'react'
import { FLAGS } from '../app/flags.ts'
import { toast } from '../app/toast.ts'
import { IcsReminder, TodayCard } from '../features/daily/index.ts'
import { watchDate } from '../lib/dateWatch.ts'
import { localDateKey } from '../lib/dates.ts'
import { useDb, useLiveQuery } from '../storage/index.ts'

export function Today() {
  const db = useDb()
  const [date, setDate] = useState(localDateKey)
  // 包一層物件，才分得出「還在查」（undefined）與「今天還沒抽」（row 為 undefined）。
  // 換日後新查詢回來前，useLiveQuery 仍回傳前一天的結果，所以帶上日期比對，不把昨天的卦當成今天的
  const state = useLiveQuery(async () => (db ? { date, row: await db.dailyDraws.get(date) } : undefined), [db, date])
  const current = state?.date === date ? state : undefined

  useEffect(() => watchDate(next => {
    setDate(next)
    toast('新的一天，可以翻開今天的卦了')
  }), [])

  return (
    <div className="today-page">
      <header className="page-head">
        <h1>今日一卦</h1>
        <p className="note">{date.replace(/-/g, '/')}</p>
      </header>
      {current ? <TodayCard key={date} date={date} row={current.row} /> : <div className="today-placeholder" aria-hidden="true" />}
      {FLAGS.reminder && <IcsReminder />}
    </div>
  )
}
