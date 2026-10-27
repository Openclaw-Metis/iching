// 修行路線（規格「經冊與畫卦」學堂路線）：八站依先天八卦方位排成一圈，乾上坤下、離左坎右。
// 路線沿太極 S 形走：乾、兌、離、震沿左半圈而下，穿過中央到巽，再經坎、艮沿右半圈到坤；已通過考核的路段為金色，
// 目前所在一站往下一站的路段以朱色虛線標出。
// 點選一站，在旁列出三課與考核，預設選目前所在的一站。鎖住的項目不給連結，旁邊寫出開放條件。

import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { HexagramGlyph } from '../../components/HexagramGlyph.tsx'
import { trigrams } from '../../data/trigrams.ts'
import { lessonId, STATION_NUMERALS, STATIONS, type Station } from '../../data/stations.ts'
import type { ExamResult, LessonProgress } from '../../storage/index.ts'
import { examStatus, LESSON_LABEL, lessonStatus, nextStep, type ExamStatus } from './grading.ts'

const EXAM_LABEL: Record<ExamStatus, string> = { locked: '三課完成後開放', available: '可考核', passed: '已通過' }
type StationState = 'passed' | 'current' | 'open' | 'locked'
const STATE_LABEL: Record<StationState, string> = { passed: '已通過', current: '目前所在', open: '可學', locked: '未開放' }

// 畫布 400 × 400，圓心 (200, 200)；角度以畫面 y 向下為準，乾在正上方
const C = 200, R = 150
const ANGLE: Record<string, number> = { 乾: -90, 兌: -135, 離: 180, 震: 135, 巽: -45, 坎: 0, 艮: 45, 坤: 90 }
function at(s: Station): [number, number] {
  const a = (ANGLE[s.trigram] * Math.PI) / 180
  return [C + R * Math.cos(a), C + R * Math.sin(a)]
}

// 第 i 站到第 i + 1 站的路段。震與巽在直徑兩端，中間以兩個半徑 R/2、彎向相反的半圓接成 S 形
function segment(from: Station, to: Station) {
  const [x0, y0] = at(from), [x1, y1] = at(to)
  const f = (v: number) => v.toFixed(1)
  if (from.trigram === '震') return `M${f(x0)} ${f(y0)}A${R / 2} ${R / 2} 0 0 1 ${C} ${C}A${R / 2} ${R / 2} 0 0 0 ${f(x1)} ${f(y1)}`
  // 左半圈由上往下是逆時針，右半圈是順時針
  return `M${f(x0)} ${f(y0)}A${R} ${R} 0 0 ${from.id < 4 ? 0 : 1} ${f(x1)} ${f(y1)}`
}

export function AcademyRoute({ progress, exams }: { progress: LessonProgress[]; exams: ExamResult[] }) {
  const next = nextStep(progress, exams)
  const currentId = !next ? 8 : next.kind === 'lesson' ? Number(next.id.slice(1, 2)) : next.stationId
  const [selected, setSelected] = useState(currentId)
  const passed = (id: number) => examStatus(id, progress, exams) === 'passed'
  const stateOf = (s: Station): StationState =>
    passed(s.id) ? 'passed'
      : s.id === currentId ? 'current'
        : lessonStatus(lessonId(s.id, 1), progress, exams) === 'locked' ? 'locked' : 'open'
  const station = STATIONS[selected - 1]

  return (
    <div className="route">
      <div className="route-map">
        <svg viewBox="0 0 400 400" aria-hidden="true">
          <circle className="route-ring" cx={C} cy={C} r={R} />
          {STATIONS.slice(0, -1).map((s, i) => (
            <path
              key={s.id}
              className={passed(s.id) ? 'route-path passed' : s.id === currentId ? 'route-path next' : 'route-path'}
              d={segment(s, STATIONS[i + 1])}
              pathLength={1}
              style={{ '--k': i } as CSSProperties}
            />
          ))}
        </svg>
        {STATIONS.map(s => {
          const [x, y] = at(s)
          const state = stateOf(s)
          return (
            <button
              key={s.id}
              type="button"
              className="route-station"
              data-state={state}
              aria-pressed={selected === s.id}
              aria-label={`第${STATION_NUMERALS[s.id - 1]}站 ${s.trigram}：${s.theme}，${STATE_LABEL[state]}`}
              style={{ left: `${(x / 400) * 100}%`, top: `${(y / 400) * 100}%` }}
              onClick={() => setSelected(s.id)}
            >
              <HexagramGlyph className="glyph" lines={trigrams.find(t => t.name === s.trigram)!.lines} />
              <b>{s.trigram}</b>
            </button>
          )
        })}
      </div>

      <StationDetail station={station} state={stateOf(station)} progress={progress} exams={exams} />
    </div>
  )
}

function StationDetail({ station: s, state, progress, exams }: { station: Station; state: StationState; progress: LessonProgress[]; exams: ExamResult[] }) {
  const exam = examStatus(s.id, progress, exams)
  const best = Math.max(0, ...exams.filter(e => e.stationId === s.id).map(e => e.score))
  return (
    <section className="station" data-state={state} aria-live="polite" aria-labelledby={`station-${s.id}`}>
      <p className="station-no">第{STATION_NUMERALS[s.id - 1]}站・{STATE_LABEL[state]}</p>
      <h3 id={`station-${s.id}`}><b>{s.trigram}</b>{s.theme}</h3>
      <p className="note">通過考核得到修為「{s.rank}」。</p>
      <ul>
        {s.lessons.map((title, i) => {
          const id = lessonId(s.id, i + 1)
          const status = lessonStatus(id, progress, exams)
          const body = <><span className="route-title"><i>{STATION_NUMERALS[i]}</i>{title}</span><span className="route-status">{LESSON_LABEL[status]}</span></>
          return (
            <li key={id} data-status={status}>
              {status === 'locked' ? <span className="route-item">{body}</span> : <Link className="route-item" to={`/academy/lesson/${id}`}>{body}</Link>}
            </li>
          )
        })}
        <li data-status={exam}>
          {exam === 'locked'
            ? <span className="route-item exam"><span className="route-title"><i>考</i>考核</span><span className="route-status">{EXAM_LABEL[exam]}</span></span>
            : (
                <Link className="route-item exam" to={`/academy/exam/${s.id}`}>
                  <span className="route-title"><i>考</i>考核</span>
                  <span className="route-status">{EXAM_LABEL[exam]}{best ? `・最高 ${best} 分` : ''}</span>
                </Link>
              )}
        </li>
      </ul>
    </section>
  )
}
