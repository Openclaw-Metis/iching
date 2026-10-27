import { Link, useParams } from 'react-router'
import { lessonId, STATION_NUMERALS, STATIONS } from '../data/stations.ts'
import { examStatus, ExamPlayer, LESSON_LABEL, lessonStatus, StationMark } from '../features/academy/index.ts'
import { lessons, useDb, useLiveQuery } from '../storage/index.ts'

export function Exam() {
  const { station = '' } = useParams()
  const stationId = Number(station)
  const db = useDb()
  const state = useLiveQuery(() => (db ? lessons.stateOf(db) : undefined), [db])

  if (!Number.isInteger(stationId) || stationId < 1 || stationId > 8) return <p className="note center">沒有這一站。<Link to="/academy">回到學堂</Link></p>
  if (!state) return <div className="lesson-player" aria-busy="true" />
  if (examStatus(stationId, state.progress, state.exams) === 'locked') {
    const station = STATIONS[stationId - 1]
    return (
      <section className="lesson-player lesson-intro">
        <div>
          <h1>第{STATION_NUMERALS[stationId - 1]}站考核</h1>
          <p>完成這一站的三課後才能考核。</p>
          <ol className="lesson-outline">
            {station.lessons.map((title, i) => {
              const id = lessonId(stationId, i + 1)
              const status = lessonStatus(id, state.progress, state.exams)
              return (
                <li key={id}>
                  <b>{STATION_NUMERALS[i]}</b>
                  <span>{status === 'locked' ? title : <Link to={`/academy/lesson/${id}`}>{title}</Link>}<small className="outline-status">{LESSON_LABEL[status]}</small></span>
                </li>
              )
            })}
          </ol>
          <div className="step-actions">
            <Link className="btn btn-primary" to="/academy">回到學堂</Link>
          </div>
        </div>
        <StationMark station={station} note={`通過晉升「${station.rank}」`} />
      </section>
    )
  }
  return <ExamPlayer key={stationId} stationId={stationId} />
}
