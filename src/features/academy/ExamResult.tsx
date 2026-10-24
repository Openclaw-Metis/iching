// 考核送出後：分數、通過與否、晉升，以及 10 題的對錯與解說。答錯的題預設展開。

import { Link } from 'react-router'
import { FLAGS } from '../../app/flags.ts'
import type { Attempt } from '../../storage/index.ts'
import type { ExamOutcome } from './attempts.ts'
import { PASS_SCORE } from './curriculum.ts'
import { isCorrect } from './grading.ts'
import { NewSeals } from './LessonPlayer.tsx'
import { QuestionCard } from './QuestionCard.tsx'

interface Props {
  attempt: Attempt
  outcome: ExamOutcome
  nextHref: string
  onRetake: () => void
}

export function ExamResult({ attempt, outcome, nextHref, onRetake }: Props) {
  return (
    <div className="exam-result" aria-live="polite">
      <p className="exam-verdict" data-passed={outcome.passed || undefined}>
        <b>{outcome.passed ? '通過' : '未通過'}</b>
        <span>{outcome.score}／{attempt.questions.length} 分</span>
      </p>
      {outcome.rankUp && <p className="exam-rank">修為晉升為「{outcome.rankUp}」</p>}
      {!outcome.passed && <p className="note">答對 {PASS_SCORE} 題以上就能通過，看完解說再考一次。</p>}
      <p className="note">這次得到 {outcome.xp} XP{FLAGS.review && outcome.reviewAdded ? `，${outcome.reviewAdded} 張卡加入溫故` : ''}。</p>
      <NewSeals ids={outcome.seals} />
      <div className="step-actions player-actions">
        {outcome.passed
          ? <Link className="btn btn-primary" to={nextHref}>前往下一站</Link>
          : <button type="button" className="btn btn-primary" onClick={onRetake}>再考一次</button>}
        <Link className="btn" to="/academy">回到學堂</Link>
      </div>
      <ol className="exam-review">
        {attempt.questions.map((q, i) => {
          const ok = isCorrect(q, attempt.answers[i])
          return (
            <li key={i}>
              <details open={!ok}>
                <summary><span data-ok={ok || undefined}>{ok ? '對' : '錯'}</span>第 {i + 1} 題</summary>
                <QuestionCard question={q} choice={attempt.answers[i]?.choice ?? null} revealed onChoose={() => {}} />
              </details>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
