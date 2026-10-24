import { Link, useParams } from 'react-router'
import { parseLessonId } from '../data/stations.ts'
import { lessonById, LessonPlayer, lessonStatus } from '../features/academy/index.ts'
import { lessons, useDb, useLiveQuery } from '../storage/index.ts'

export function Lesson() {
  const { id = '' } = useParams()
  const lesson = lessonById(id)
  const db = useDb()
  const state = useLiveQuery(() => (db ? lessons.stateOf(db) : undefined), [db])

  if (!lesson) return <p className="note center">沒有這一課。<Link to="/academy">回到學堂</Link></p>
  if (!state) return <div className="lesson-player" aria-busy="true" />
  if (lessonStatus(id, state.progress, state.exams) === 'locked') {
    return (
      <div className="lesson-player">
        <h1>{lesson.title}</h1>
        <p>這一課還沒開放：先完成前一課；每站的第一課要等前一站考核通過。</p>
        <Link className="btn btn-primary" to="/academy">回到學堂</Link>
      </div>
    )
  }
  const { station, index } = parseLessonId(id)!
  const nextHref = index < 3 ? `/academy/lesson/S${station.id}-L${index + 1}` : `/academy/exam/${station.id}`
  return <LessonPlayer key={id} lessonId={id} nextHref={nextHref} />
}
