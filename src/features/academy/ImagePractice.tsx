// 看圖猜卦練習：每次 10 題，按「檢查」立即揭露對錯。進度只在當次有效，離開就結束。

import { useMemo, useRef, useState } from 'react'
import { toast } from '../../app/toast.ts'
import { answerPractice, practiceQuestions, PRACTICE_SIZE } from './practice.ts'
import { QuestionCard } from './QuestionCard.tsx'

interface Props {
  /** 已答對過看圖題的卦序 */
  masteredImage: ReadonlySet<number>
  onExit: () => void
}

export function ImagePractice({ masteredImage, onExit }: Props) {
  // 開始時決定這一輪的題目；之後掌握紀錄變動也不換題
  const [questions] = useState(() => practiceQuestions(masteredImage))
  const sessionId = useMemo(() => crypto.randomUUID(), [])
  const [index, setIndex] = useState(0)
  const [choice, setChoice] = useState<number | null>(null)
  const [result, setResult] = useState<{ correct: boolean; xp: number; capped: boolean } | null>(null)
  const [score, setScore] = useState(0)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const shownAt = useRef(performance.now())
  const q = questions[index]

  const check = async () => {
    if (choice === null || busy) return
    setBusy(true)
    try {
      const r = await answerPractice(sessionId, index, q, choice, Math.round(performance.now() - shownAt.current))
      setResult(r)
      if (r.correct) setScore(s => s + 1)
    } catch {
      toast('這題的結果沒有存起來，可以繼續練習。')
      setResult({ correct: choice === q.answerIndex, xp: 0, capped: false })
    } finally {
      setBusy(false)
    }
  }

  const next = () => {
    if (index + 1 >= questions.length) return setDone(true)
    setIndex(i => i + 1)
    setChoice(null)
    setResult(null)
    shownAt.current = performance.now()
  }

  if (done) {
    return (
      <section className="practice">
        <h2>看圖猜卦練習</h2>
        <p className="practice-score">答對 {score}／{PRACTICE_SIZE} 題</p>
        <p className="note">答對過的卦會記入掌握紀錄；64 卦都看圖答對過，就能取得「全」印。</p>
        <div className="step-actions">
          <button type="button" className="btn btn-primary" onClick={onExit}>回到學堂</button>
        </div>
      </section>
    )
  }

  return (
    <section className="practice lesson-player">
      <header className="player-head">
        <h2>看圖猜卦練習</h2>
        <span className="player-count">第 {index + 1} 題／共 {questions.length} 題</span>
      </header>
      <div className="progress" aria-hidden="true"><span style={{ width: `${(index / questions.length) * 100}%` }} /></div>
      <QuestionCard
        key={index}
        question={q}
        choice={choice}
        revealed={result !== null}
        disabled={busy}
        onChoose={setChoice}
        feedback={result && (result.xp ? <p className="q-xp">＋{result.xp} XP</p> : result.capped ? <p className="q-xp">今天的作答 XP 已滿，仍可繼續練習</p> : null)}
      />
      <div className="step-actions player-actions">
        {result === null
          ? <button type="button" className="btn btn-primary" disabled={choice === null || busy} onClick={() => void check()}>檢查</button>
          : <button type="button" className="btn btn-primary" onClick={next}>{index + 1 >= questions.length ? '看結果' : '下一題'}</button>}
        <button type="button" className="btn" onClick={onExit}>結束練習</button>
      </div>
    </section>
  )
}
