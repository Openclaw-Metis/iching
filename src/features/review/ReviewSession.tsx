// 溫故場次（規格「流程 D」）：逐張作答，答錯記重來、答對記良好、3 秒內答對記容易。
// 答錯的卡排到這一場的最後再出現一次；答過 10 張不同的卡或集合全部答過就完成一輪。
// 題目的產生與呈現由頁面提供（學堂的出題器與題目卡），溫故模組不反過來依賴學堂。

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from '../../app/toast.ts'
import { formatDateTime } from '../../lib/dates.ts'
import { logError, requireDb, review, type QuestionSnapshot, type ReviewCard } from '../../storage/index.ts'
import { awardRound, grade, ROUND_SIZE, roundComplete, startSession, type Session } from './session.ts'

export interface QuestionViewProps {
  question: QuestionSnapshot
  choice: number | null
  revealed: boolean
  disabled?: boolean
  onChoose: (index: number) => void
  feedback?: ReactNode
}

interface Props {
  makeQuestion: (card: ReviewCard) => QuestionSnapshot
  QuestionView: ComponentType<QuestionViewProps>
  /** 完成一輪後（例如判定印章） */
  onRoundComplete?: () => void
}

type Phase =
  | { name: 'loading' }
  | { name: 'empty'; nextDue: string | null }
  | { name: 'active'; session: Session }
  | { name: 'done'; answered: number }

export function ReviewSession({ makeQuestion, QuestionView, onRoundComplete }: Props) {
  const [phase, setPhase] = useState<Phase>({ name: 'loading' })
  const [queue, setQueue] = useState<string[]>([])
  const [question, setQuestion] = useState<QuestionSnapshot | null>(null)
  const [choice, setChoice] = useState<number | null>(null)
  const [result, setResult] = useState<{ correct: boolean; due: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [rounds, setRounds] = useState(0)
  // 每換一張就加一；答錯的卡若是最後一張會立刻再出現，卡號相同也要重新出題
  const [turn, setTurn] = useState(0)
  const answered = useRef(new Set<string>())
  const awarded = useRef(false)
  const shownAt = useRef(performance.now())

  const begin = async () => {
    setPhase({ name: 'loading' })
    answered.current = new Set()
    awarded.current = false
    const s = await startSession()
    if (!s.cardIds.length) {
      const cards = await review.allOf(await requireDb())
      const next = cards.filter(c => !c.removedAt).map(c => c.due).sort()[0] ?? null
      setPhase({ name: 'empty', nextDue: next })
      return
    }
    setQueue(s.cardIds)
    setTurn(t => t + 1)
    setPhase({ name: 'active', session: s })
  }

  useEffect(() => { void begin().catch(() => setPhase({ name: 'empty', nextDue: null })) }, [])

  // 換到下一張卡時出題
  const current = queue[0]
  useEffect(() => {
    if (!current) return
    let alive = true
    review.get(current).then(card => {
      if (!alive || !card) return
      setQuestion(makeQuestion(card))
      setChoice(null)
      setResult(null)
      shownAt.current = performance.now()
    }, () => {})
    return () => { alive = false }
    // makeQuestion 由頁面固定提供，換卡才需要重出
  }, [current, turn])

  if (phase.name === 'loading') return <div className="lesson-player" aria-busy="true" />

  if (phase.name === 'empty') {
    return (
      <section className="lesson-player">
        <h1>溫故</h1>
        <p>現在沒有待溫的卡。</p>
        {phase.nextDue && <p className="note">下一張在 {formatDateTime(phase.nextDue)} 到期。</p>}
        <p className="note">在學堂答對卦畫或看圖題，或在卡牌頁按「加入溫故」，卦牌就會進入溫故。</p>
        <div className="step-actions player-actions"><Link className="btn btn-primary" to="/academy">回到學堂</Link></div>
      </section>
    )
  }

  if (phase.name === 'done') {
    return (
      <section className="lesson-player resolved" aria-live="polite">
        <h1>溫故</h1>
        <h2>這一場結束了</h2>
        <p>答了 {phase.answered} 張不同的卡{rounds ? `，完成 ${rounds} 輪` : ''}。</p>
        <div className="step-actions player-actions">
          <Link className="btn btn-primary" to="/academy">回到學堂</Link>
          <button type="button" className="btn" onClick={() => void begin()}>再溫一輪</button>
        </div>
      </section>
    )
  }

  const { session } = phase
  const check = async () => {
    if (choice === null || !question || busy) return
    setBusy(true)
    const correct = choice === question.answerIndex
    try {
      const card = await grade(session.sessionId, current, correct, Math.round(performance.now() - shownAt.current))
      answered.current.add(current)
      setResult({ correct, due: card.due })
      if (!awarded.current && roundComplete(session, answered.current)) {
        awarded.current = true
        setRounds(r => r + 1)
        const r = await awardRound(session.sessionId)
        toast(r.awarded ? `完成一輪溫故，得到 ${r.awarded} XP` : r.capped ? '完成一輪溫故；今天的溫故 XP 已滿（每天 3 輪）' : '完成一輪溫故')
        onRoundComplete?.()
      }
    } catch (e) {
      logError('REVIEW_GRADE_FAILED', String((e as Error)?.message ?? e))
      toast('這張的結果沒有存起來，請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  const next = () => {
    const rest = queue.slice(1)
    // 答錯的卡排到最後再出現一次，完成條件只看不同的卡
    const nextQueue = result && !result.correct ? [...rest, current] : rest
    if (!nextQueue.length) return setPhase({ name: 'done', answered: answered.current.size })
    setQueue(nextQueue)
    setTurn(t => t + 1)
  }

  const goal = Math.min(ROUND_SIZE, session.cardIds.length)
  return (
    <section className="lesson-player">
      <header className="player-head">
        <h1>溫故</h1>
        <span className="player-count">這一輪 {Math.min(answered.current.size, goal)}／{goal} 張・剩 {queue.length} 張</span>
      </header>
      <div className="progress" aria-hidden="true"><span style={{ width: `${(Math.min(answered.current.size, goal) / goal) * 100}%` }} /></div>
      {question && (
        <QuestionView
          key={turn}
          question={question}
          choice={choice}
          revealed={result !== null}
          disabled={busy}
          onChoose={setChoice}
          feedback={result && <p className="q-xp">{result.correct ? '記為「良好」或「容易」' : '記為「重來」，這一場稍後會再出現'}・下次 {formatDateTime(result.due)}</p>}
        />
      )}
      <div className="step-actions player-actions">
        {result === null
          ? <button type="button" className="btn btn-primary" disabled={choice === null || busy} onClick={() => void check()}>檢查</button>
          : <button type="button" className="btn btn-primary" onClick={next}>下一張</button>}
        <button type="button" className="btn" onClick={() => setPhase({ name: 'done', answered: answered.current.size })}>結束</button>
      </div>
    </section>
  )
}
