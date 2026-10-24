// 修行路線：8 站，每站 3 課與 1 場考核。鎖住的項目不給連結，旁邊寫出開放條件。

import { Link } from 'react-router'
import { lessonId, STATION_NUMERALS, STATIONS } from '../../data/stations.ts'
import type { ExamResult, LessonProgress } from '../../storage/index.ts'
import { examStatus, lessonStatus, type ExamStatus, type LessonStatus } from './grading.ts'

const LESSON_LABEL: Record<LessonStatus, string> = { locked: '未開放', available: '可學', 'in-progress': '學習中', completed: '完成' }
const EXAM_LABEL: Record<ExamStatus, string> = { locked: '三課完成後開放', available: '可考核', passed: '已通過' }

export function AcademyRoute({ progress, exams }: { progress: LessonProgress[]; exams: ExamResult[] }) {
  return (
    <ol className="route">
      {STATIONS.map(s => {
        const exam = examStatus(s.id, progress, exams)
        const best = Math.max(0, ...exams.filter(e => e.stationId === s.id).map(e => e.score))
        return (
          <li key={s.id} className="station" data-passed={exam === 'passed' || undefined}>
            <h3><span className="station-no">第{STATION_NUMERALS[s.id - 1]}站</span>{s.trigram}・{s.theme}</h3>
            <ul>
              {s.lessons.map((title, i) => {
                const id = lessonId(s.id, i + 1)
                const status = lessonStatus(id, progress, exams)
                const body = <><span className="route-title">{title}</span><span className="route-status">{LESSON_LABEL[status]}</span></>
                return (
                  <li key={id} data-status={status}>
                    {status === 'locked' ? <span className="route-item">{body}</span> : <Link className="route-item" to={`/academy/lesson/${id}`}>{body}</Link>}
                  </li>
                )
              })}
              <li data-status={exam}>
                {exam === 'locked'
                  ? <span className="route-item exam"><span className="route-title">考核</span><span className="route-status">{EXAM_LABEL[exam]}</span></span>
                  : (
                      <Link className="route-item exam" to={`/academy/exam/${s.id}`}>
                        <span className="route-title">考核</span>
                        <span className="route-status">{EXAM_LABEL[exam]}{best ? `・最高 ${best} 分` : ''}</span>
                      </Link>
                    )}
              </li>
            </ul>
          </li>
        )
      })}
    </ol>
  )
}
