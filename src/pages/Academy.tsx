// 學堂首頁（規格「流程 C」）：修為摘要列（修為、連續天數、印譜）、今日目標與「繼續下一課」、溫故入口
// （功能開關關閉時不顯示）、修行路線，路線下方是看圖猜卦練習入口。

import { useState } from 'react'
import { Link } from 'react-router'
import { FLAGS } from '../app/flags.ts'
import { rise } from '../components/rise.ts'
import { STATION_NUMERALS } from '../data/stations.ts'
import { AcademyRoute, DailyGoalRing, highestPassed, ImagePractice, lessonById, nextStep, RankBadge } from '../features/academy/index.ts'
import { lessons, review, useDb, useLiveQuery, xp } from '../storage/index.ts'

export function Academy() {
  const db = useDb()
  const state = useLiveQuery(() => (db ? lessons.stateOf(db) : undefined), [db])
  const summary = useLiveQuery(() => (db ? xp.summaryOf(db) : undefined), [db])
  const due = useLiveQuery<number | undefined>(() => (db && FLAGS.review ? review.dueCount(db) : undefined), [db])
  const [practicing, setPracticing] = useState(false)

  if (!state || !summary) return <div className="academy" aria-busy="true" />

  const imageDone = new Set(state.mastery.filter(m => m.facet === 'image').map(m => m.hexagram))
  if (practicing) {
    return (
      <div className="academy">
        <ImagePractice masteredImage={imageDone} onExit={() => setPracticing(false)} />
      </div>
    )
  }

  const next = nextStep(state.progress, state.exams)
  const nextLabel = !next ? null
    : next.kind === 'lesson' ? `繼續下一課：${lessonById(next.id)!.title}`
      : `參加第${STATION_NUMERALS[next.stationId - 1]}站考核`
  const nextHref = !next ? null : next.kind === 'lesson' ? `/academy/lesson/${next.id}` : `/academy/exam/${next.stationId}`

  return (
    <div className="academy">
      <header className="page-head rise" style={rise(0)}><h1>學堂</h1></header>
      <div className="academy-overview rise" style={rise(1)}>
        <RankBadge highest={highestPassed(state.exams)} total={summary.total} streak={summary.streak} best={summary.best} />
        <section className="academy-today">
          <DailyGoalRing today={summary.today} goal={summary.goal} />
          <div className="academy-next">
            {nextHref ? <Link className="btn btn-primary" to={nextHref}>{nextLabel}</Link> : <p>八站都已完成，可以從路線重溫任何一課。</p>}
          </div>
        </section>
      </div>
      {FLAGS.review && (
        <section className="review-entry">
          <h2>溫故</h2>
          <p>{due ? `今天待溫 ${due} 張` : '今天沒有待溫的卡'}</p>
          <Link className={due ? 'btn btn-primary' : 'btn'} to="/academy/review">{due ? '開始溫故' : '看看溫故'}</Link>
        </section>
      )}
      <section className="academy-route rise" style={rise(2)}>
        <h2>修行路線</h2>
        <p className="note">八站依先天八卦方位排成一圈，路線由乾沿太極 S 形走到坤。點一站看它的三課與考核。</p>
        <AcademyRoute progress={state.progress} exams={state.exams} />
      </section>
      <section className="practice-entry rise" style={rise(3)}>
        <h2>看圖猜卦練習</h2>
        <p className="note">每次 10 題，只看卡圖的背景與人物猜是哪一卦，優先出還沒答對過的卦。已看圖答對 {imageDone.size}／64 卦。</p>
        <button type="button" className="btn" onClick={() => setPracticing(true)}>開始練習</button>
      </section>
    </div>
  )
}
