// 今日目標圓環：今天的 XP 對每日目標（20、30、50）。齒輪打開抽屜改目標；
// 改目標不影響過去的打卡，但目標調低後若今天已達標，立刻補上打卡。

import { useState } from 'react'
import { toast } from '../../app/toast.ts'
import { Drawer } from '../../components/Drawer.tsx'
import { settings, xp } from '../../storage/index.ts'

const GOALS = [20, 30, 50] as const

export function DailyGoalRing({ today, goal }: { today: number; goal: number }) {
  const [open, setOpen] = useState(false)
  const ratio = Math.min(1, goal ? today / goal : 0)
  const r = 42, c = 2 * Math.PI * r
  const reached = today >= goal

  const choose = async (g: (typeof GOALS)[number]) => {
    try {
      await settings.set('dailyGoal', g)
      await xp.ensureCheckIn()
      setOpen(false)
    } catch {
      toast('目標沒有存起來，請再試一次。')
    }
  }

  return (
    <div className="goal-ring">
      <svg viewBox="0 0 100 100" role="img" aria-label={`今日目標 ${goal} XP，已得到 ${today} XP`}>
        <circle cx="50" cy="50" r={r} className="ring-track" />
        <circle cx="50" cy="50" r={r} className="ring-value" strokeDasharray={`${c * ratio} ${c}`} transform="rotate(-90 50 50)" />
      </svg>
      <div className="goal-text">
        <b>{today}</b><span>／{goal} XP</span>
        <small>{reached ? '今日目標已達成' : '今日目標'}</small>
      </div>
      <button type="button" className="btn goal-gear" aria-label="設定每日目標" onClick={() => setOpen(true)}>⚙</button>
      <Drawer open={open} title="每日目標" onClose={() => setOpen(false)}>
        <p className="note">每天得到這麼多 XP 就算達標。改目標不影響過去的紀錄。</p>
        <div className="segmented goal-options" role="group" aria-label="每日目標">
          {GOALS.map(g => (
            <button key={g} type="button" aria-pressed={goal === g} onClick={() => void choose(g)}>{g} XP</button>
          ))}
        </div>
        <p className="note">翻開今日卦、完成占卜各 5 XP；完成一課 10 XP；第一次就答對一題 2 XP（每天作答最多 100 XP）；通過考核 30 XP。</p>
      </Drawer>
    </div>
  )
}
