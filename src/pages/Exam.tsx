import { Link, useParams } from 'react-router'
import { STATION_NUMERALS } from '../data/stations.ts'
import { examStatus, ExamPlayer } from '../features/academy/index.ts'
import { lessons, useDb, useLiveQuery } from '../storage/index.ts'

export function Exam() {
  const { station = '' } = useParams()
  const stationId = Number(station)
  const db = useDb()
  const state = useLiveQuery(() => (db ? lessons.stateOf(db) : undefined), [db])

  if (!Number.isInteger(stationId) || stationId < 1 || stationId > 8) return <p className="note center">沒有這一站。<Link to="/academy">回到學堂</Link></p>
  if (!state) return <div className="lesson-player" aria-busy="true" />
  if (examStatus(stationId, state.progress, state.exams) === 'locked') {
    return (
      <div className="lesson-player">
        <h1>第{STATION_NUMERALS[stationId - 1]}站考核</h1>
        <p>完成這一站的三課後才能考核。</p>
        <Link className="btn btn-primary" to="/academy">回到學堂</Link>
      </div>
    )
  }
  return <ExamPlayer key={stationId} stationId={stationId} />
}
