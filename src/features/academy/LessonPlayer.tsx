// 課程與考核播放器（規格「狀態矩陣（課程頁）」）。
// 課程：閱讀步驟按「繼續」；作答步驟選了答案才能「檢查」，檢查後顯示對錯、解說與 XP，再按「下一步」。
// 考核：逐題作答不揭露，第 10 題按「送出」後一次顯示 10 題的對錯與解說。
// 每次選答、檢查、前進都寫入作答進度；寫入失敗時已作答的內容留在畫面上，按重試再存一次。

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { FLAGS } from '../../app/flags.ts'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { HexagramGlyph } from '../../components/HexagramGlyph.tsx'
import { hexagram } from '../../data/hexagrams.ts'
import { lessonId as lessonIdOf, STATION_NUMERALS, STATIONS } from '../../data/stations.ts'
import { trigramById } from '../../data/trigrams.ts'
import { localDateKey } from '../../lib/dates.ts'
import { ERROR_MESSAGES, isAppError } from '../../lib/errors.ts'
import { track } from '../../lib/events.ts'
import { attempts as attemptsRepo, lessons, logError, type Attempt, type SealId } from '../../storage/index.ts'
import { advance, answer, completeLesson, restart, select, startAttempt, submitExam, type ExamOutcome, type LessonOutcome } from './attempts.ts'
import { EXAM_SIZE, flatten, lessonById, PASS_SCORE, type ReadStep } from './curriculum.ts'
import { ExamResult } from './ExamResult.tsx'
import { StationMark } from './StationMark.tsx'
import { isSealShown } from './seals.ts'
import { SealStamp } from './SealStamp.tsx'
import { QuestionCard } from './QuestionCard.tsx'

type Failure = { message: string; retry: () => void; retryLabel?: string } | null

/** 寫入失敗時保留畫面，提供重試 */
function useGuard(onExpired?: () => void) {
  const [failure, setFailure] = useState<Failure>(null)
  const [busy, setBusy] = useState(false)
  const run = async (action: () => Promise<void>, code = 'ACADEMY_SAVE_FAILED') => {
    setBusy(true)
    setFailure(null)
    try {
      await action()
    } catch (e) {
      logError(isAppError(e) ? e.code : code, String((e as Error)?.message ?? e))
      if (isAppError(e, 'EXAM_EXPIRED') && onExpired) {
        setFailure({ message: ERROR_MESSAGES.EXAM_EXPIRED, retryLabel: '重新開始考核', retry: () => { setFailure(null); onExpired() } })
        return
      }
      const message = isAppError(e, 'STORAGE_QUOTA') ? ERROR_MESSAGES.STORAGE_QUOTA
        : isAppError(e, 'WRITE_CONFLICT') ? '這次作答在另一個分頁有了變動，請重新整理後再繼續。'
          : '作答進度沒有存起來，已作答的內容還在畫面上。'
      setFailure({ message, retry: () => void run(action, code) })
    } finally {
      setBusy(false)
    }
  }
  const banner = failure && (
    <div className="inline-warning" role="alert">
      <p>{failure.message}</p>
      <button type="button" className="btn" onClick={failure.retry}>{failure.retryLabel ?? '重試'}</button>
    </div>
  )
  return { run, busy, banner }
}

function Progress({ value, total, label }: { value: number; total: number; label: string }) {
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
      <span style={{ width: `${(value / total) * 100}%` }} />
    </div>
  )
}

function ReadView({ step }: { step: ReadStep }) {
  return (
    <div className="read-step">
      {step.hexagram && <HexagramGlyph lines={hexagram(step.hexagram).lines} className="read-glyph" />}
      {step.trigram && <HexagramGlyph lines={trigramById[step.trigram].lines} className="read-glyph trigram" />}
      <p>{step.text}</p>
    </div>
  )
}

const xpNote = (r: { xp: number; capped: boolean } | null): ReactNode =>
  r && (r.xp ? <p className="q-xp">＋{r.xp} XP</p> : r.capped ? <p className="q-xp">今天的作答 XP 已滿，仍可繼續練習</p> : null)

export function NewSeals({ ids }: { ids: SealId[] }) {
  const shown = ids.filter(isSealShown)
  if (!shown.length) return null
  return (
    <div className="new-seals">
      <p>取得新的印章</p>
      <div>{shown.map(id => <SealStamp key={id} id={id} earned />)}</div>
    </div>
  )
}

// ── 課程 ─────────────────────────────────────────────

type LessonPhase =
  | { name: 'loading' }
  | { name: 'empty' }
  | { name: 'active'; attempt: Attempt }
  | { name: 'resolved'; outcome: LessonOutcome; gained: number; reviewAdded: number }

// 閱讀段落的第一句，課程開始前列出這一課會讀到什麼
function excerpt(text: string) {
  const first = text.split('。')[0]
  return [...first].length > 26 ? [...first].slice(0, 26).join('') + '…' : first + '。'
}

export function LessonPlayer({ lessonId, nextHref }: { lessonId: string; nextHref?: string }) {
  const lesson = lessonById(lessonId)!
  const flat = useMemo(() => flatten(lesson), [lesson])
  const [phase, setPhase] = useState<LessonPhase>({ name: 'loading' })
  const [selected, setSelected] = useState<number | null>(null)
  const [lastCheck, setLastCheck] = useState<{ xp: number; capped: boolean } | null>(null)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const gained = useRef(0)
  const reviewAdded = useRef(0)
  const shownAt = useRef(performance.now())
  const { run, busy, banner } = useGuard()

  useEffect(() => {
    let alive = true
    attemptsRepo.findActive('lesson', lessonId, localDateKey()).then(
      a => { if (alive) setPhase(a ? { name: 'active', attempt: a } : { name: 'empty' }) },
      () => { if (alive) setPhase({ name: 'empty' }) },
    )
    return () => { alive = false }
  }, [lessonId])

  const correctOf = (a: Attempt) => a.answers.filter(x => x?.correct).length
  const show = (a: Attempt) => {
    setPhase({ name: 'active', attempt: a })
    setSelected(null)
    setLastCheck(null)
    shownAt.current = performance.now()
  }

  const start = () => run(async () => {
    const a = await startAttempt('lesson', lessonId)
    await lessons.touchLesson(lesson.id, lesson.station.id, a.position, correctOf(a), flat.length)
    track('lesson_start', { lessonId })
    show(a)
  })

  if (phase.name === 'loading') return <div className="lesson-player" aria-busy="true" />

  const head = (
    <header className="player-head">
      <h1>{lesson.title}</h1>
      <span className="player-count">第{STATION_NUMERALS[lesson.station.id - 1]}站・{lesson.station.theme}</span>
    </header>
  )

  if (phase.name === 'empty') {
    return (
      <section className="lesson-player lesson-intro">
        <div>
          {head}
          <p className="note">約 {lesson.minutes} 分鐘・共 {flat.length} 步（閱讀 {flat.filter(s => s.kind === 'read').length} 段、作答 {flat.filter(s => s.kind === 'question').length} 題）</p>
          <ol className="lesson-outline">
            {lesson.steps.map((s, i) => (
              <li key={i}>{s.kind === 'read' ? <><b>讀</b><span>{excerpt(s.text)}</span></> : <><b>答</b><span>{s.count} 題</span></>}</li>
            ))}
          </ol>
          {banner}
          <div className="step-actions player-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void start()}>開始</button>
          </div>
        </div>
        <StationMark station={lesson.station} note={`第${STATION_NUMERALS[Number(lesson.id.slice(-1)) - 1]}課，共三課`} />
      </section>
    )
  }

  if (phase.name === 'resolved') {
    const { outcome } = phase
    return (
      <section className="lesson-player resolved" aria-live="polite">
        {head}
        <h2>完成這一課</h2>
        <dl className="kv">
          <dt>答對</dt><dd>{outcome.correct}／{outcome.total} 題</dd>
          <dt>這次得到</dt><dd>{phase.gained} XP</dd>
          {FLAGS.review && <><dt>加入溫故</dt><dd>{phase.reviewAdded} 張</dd></>}
        </dl>
        <NewSeals ids={outcome.seals} />
        <div className="step-actions player-actions">
          {nextHref && <Link className="btn btn-primary" to={nextHref}>下一步</Link>}
          <Link className={nextHref ? 'btn' : 'btn btn-primary'} to="/academy">回到學堂</Link>
        </div>
      </section>
    )
  }

  const { attempt } = phase
  const position = Math.min(attempt.position, flat.length - 1)
  const step = flat[position]
  const last = position === flat.length - 1

  const next = () => run(async () => {
    if (last) {
      const outcome = await completeLesson(attempt.id)
      gained.current += outcome.xp
      track('lesson_complete', { lessonId, correct: outcome.correct, total: outcome.total })
      setPhase({ name: 'resolved', outcome, gained: gained.current, reviewAdded: reviewAdded.current })
      return
    }
    const a = await advance(attempt.id, position + 1)
    await lessons.touchLesson(lesson.id, lesson.station.id, a.position, correctOf(a), flat.length)
    show(a)
  })

  let body: ReactNode
  let cta: ReactNode
  if (step.kind === 'read') {
    body = <ReadView step={step.step} />
    cta = <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void next()}>繼續</button>
  } else {
    const index = step.index
    const q = attempt.questions[index]
    const saved = attempt.answers[index]
    const checked = Boolean(saved?.checked)
    const choice = checked ? saved!.choice : selected ?? saved?.choice ?? null
    const choose = (i: number) => {
      setSelected(i)
      // 選了還沒檢查也先存；失敗不打斷作答，按檢查時會再寫一次
      void select(attempt.id, index, i).catch(() => {})
    }
    const check = () => run(async () => {
      if (choice === null) return
      const r = await answer(attempt.id, index, choice, Math.round(performance.now() - shownAt.current))
      if (!('correct' in r)) return
      gained.current += r.xp
      if (r.reviewAdded) reviewAdded.current++
      setPhase({ name: 'active', attempt: r.attempt })
      setLastCheck({ xp: r.xp, capped: r.capped })
    })
    const enter = busy ? undefined : checked ? () => void next() : choice !== null ? () => void check() : undefined
    body = <QuestionCard key={`${attempt.id}-${index}`} question={q} choice={choice} revealed={checked} disabled={busy} onChoose={choose} onEnter={enter} feedback={xpNote(lastCheck)} />
    cta = checked
      ? <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void next()}>{last ? '完成' : '下一步'}</button>
      : <button type="button" className="btn btn-primary" disabled={busy || choice === null} onClick={() => void check()}>檢查</button>
  }

  const earlier = flat.slice(0, position).filter((s): s is { kind: 'read'; step: ReadStep } => s.kind === 'read')

  return (
    <section className="lesson-player">
      {head}
      <Progress value={position + 1} total={flat.length} label={`第 ${position + 1} 步，共 ${flat.length} 步`} />
      {body}
      {banner}
      <div className="step-actions player-actions">{cta}</div>
      <div className="player-extra">
        {earlier.length > 0 && (
          <details className="accordion">
            <summary>回看前面的說明</summary>
            {earlier.map((s, i) => <p key={i}>{s.step.text}</p>)}
          </details>
        )}
        <button type="button" className="link-button" onClick={() => setConfirmRestart(true)}>重新開始本課</button>
      </div>
      <ConfirmDialog
        open={confirmRestart}
        title="重新開始這一課？"
        confirmLabel="重新開始"
        onCancel={() => setConfirmRestart(false)}
        onConfirm={() => {
          setConfirmRestart(false)
          void run(async () => {
            await restart(attempt.id)
            setPhase({ name: 'empty' })
          })
        }}
      >
        <p>這一課的作答會清掉，題目重新出。已經得到的 XP 不會扣回。</p>
      </ConfirmDialog>
    </section>
  )
}

// ── 考核 ─────────────────────────────────────────────

type ExamPhase =
  | { name: 'loading' }
  | { name: 'empty' }
  | { name: 'active'; attempt: Attempt }
  | { name: 'submitted'; attempt: Attempt; outcome: ExamOutcome }

export function ExamPlayer({ stationId }: { stationId: number }) {
  const station = STATIONS[stationId - 1]
  const [phase, setPhase] = useState<ExamPhase>({ name: 'loading' })
  const [selected, setSelected] = useState<number | null>(null)
  const shownAt = useRef(performance.now())
  const { run, busy, banner } = useGuard(() => {
    setPhase({ name: 'empty' })
    setSelected(null)
  })

  useEffect(() => {
    let alive = true
    attemptsRepo.findActive('exam', String(stationId), localDateKey()).then(
      a => { if (alive) setPhase(a ? { name: 'active', attempt: a } : { name: 'empty' }) },
      () => { if (alive) setPhase({ name: 'empty' }) },
    )
    return () => { alive = false }
  }, [stationId])

  const show = (a: Attempt) => {
    setPhase({ name: 'active', attempt: a })
    setSelected(null)
    shownAt.current = performance.now()
  }

  const start = () => run(async () => {
    const a = await startAttempt('exam', String(stationId))
    track('exam_start', { stationId })
    show(a)
  })

  if (phase.name === 'loading') return <div className="lesson-player" aria-busy="true" />

  const head = (
    <header className="player-head">
      <h1>第{STATION_NUMERALS[stationId - 1]}站考核</h1>
      <span className="player-count">{station.trigram}・{station.theme}</span>
    </header>
  )

  if (phase.name === 'empty') {
    return (
      <section className="lesson-player lesson-intro">
        <div>
          {head}
          <p>共 {EXAM_SIZE} 題，答對 {PASS_SCORE} 題以上通過，通過後晉升為「{station.rank}」並開放下一站。</p>
          <p className="note">考核逐題作答，送出後才一起顯示對錯；當天沒考完，隔天回來會重新出題。</p>
          {banner}
          <div className="step-actions player-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void start()}>開始考核</button>
          </div>
        </div>
        <StationMark station={station} note={`通過晉升「${station.rank}」`} />
      </section>
    )
  }

  if (phase.name === 'submitted') {
    const nextHref = stationId < 8 ? `/academy/lesson/${lessonIdOf(stationId + 1, 1)}` : '/academy'
    return (
      <section className="lesson-player">
        {head}
        <ExamResult attempt={phase.attempt} outcome={phase.outcome} nextHref={nextHref} onRetake={() => void start()} />
      </section>
    )
  }

  const { attempt } = phase
  const index = Math.min(attempt.position, attempt.questions.length - 1)
  const q = attempt.questions[index]
  const choice = selected ?? attempt.answers[index]?.choice ?? null
  const last = index === attempt.questions.length - 1

  const choose = (choice: number) => {
    setSelected(choice)
    void run(async () => {
      await answer(attempt.id, index, choice, Math.round(performance.now() - shownAt.current))
    })
  }

  const save = () => run(async () => {
    if (choice === null) return
    const r = await answer(attempt.id, index, choice, Math.round(performance.now() - shownAt.current))
    if (!last) return show(await advance(r.attempt.id, index + 1))
    const outcome = await submitExam(attempt.id)
    track('exam_submit', { stationId, score: outcome.score, passed: outcome.passed })
    setPhase({ name: 'submitted', attempt: (await attemptsRepo.get(attempt.id)) ?? r.attempt, outcome })
  })

  return (
    <section className="lesson-player">
      {head}
      <div className="player-count-row"><span>第 {index + 1} 題／共 {attempt.questions.length} 題</span></div>
      <Progress value={index + 1} total={attempt.questions.length} label={`第 ${index + 1} 題，共 ${attempt.questions.length} 題`} />
      <QuestionCard key={`${attempt.id}-${index}`} question={q} choice={choice} revealed={false} disabled={busy} onChoose={choose} onEnter={!busy && choice !== null ? () => void save() : undefined} />
      {banner}
      <div className="step-actions player-actions">
        <button type="button" className="btn btn-primary" disabled={busy || choice === null} onClick={() => void save()}>{last ? '送出' : '下一題'}</button>
      </div>
    </section>
  )
}
