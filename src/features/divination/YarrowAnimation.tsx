// 大衍一鍵完成的過程動畫。六爻在播放前就已算好並存成紀錄，動畫只是呈現：18 變每變約 0.3 秒，
// 全長不超過 6 秒，可以跳過；使用者設定減少動態效果時直接顯示結果。

import { useEffect, useState } from 'react'
import { LineBuilder } from '../../components/LineBuilder.tsx'
import type { YarrowLine } from './yarrow.ts'

const STEP_MS = 300

interface Props {
  lines: YarrowLine[]
  onDone: () => void
}

export function YarrowAnimation({ lines, onDone }: Props) {
  const changes = lines.flatMap(l => l.changes)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { onDone(); return }
    if (step >= changes.length) { const t = setTimeout(onDone, 500); return () => clearTimeout(t) }
    const t = setTimeout(() => setStep(s => s + 1), STEP_MS)
    return () => clearTimeout(t)
  }, [step, changes.length, onDone])

  const shown = Math.min(step, changes.length)
  const current = changes[Math.max(0, shown - 1)]
  const linesDone = lines.slice(0, Math.floor(shown / 3)).map(l => l.value)
  const right = current.start - current.left - 1

  return (
    <section className="divine-step cast-step yarrow-anim">
      <div className="cast-figure">
        <LineBuilder lines={linesDone} />
      </div>
      <div className="cast-panel">
        <p className="cast-progress" aria-live="polite">分蓍中：第 {Math.max(1, shown)} 步／共 18 步</p>
        <YarrowBundle total={current.start} left={current.left} />
        <p className="note">
          {`${current.start} 根分為左 ${current.left}、右 ${right + 1}，掛一，四根一數，左餘 ${current.left % 4 || 4}、右餘 ${right % 4 || 4}，去 ${current.removed} 根，餘 ${current.remaining} 根。`}
        </p>
        <button type="button" className="btn" onClick={onDone}>跳過</button>
      </div>
    </section>
  )
}

/** 一束蓍草：細線代表每一根，左右兩堆之間留空 */
export function YarrowBundle({ total, left }: { total: number; left: number }) {
  const w = 3, gap = 2, split = 14
  const width = total * (w + gap) + split
  return (
    <svg className="yarrow-bundle" viewBox={`0 0 ${width} 60`} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <rect key={i} x={i * (w + gap) + (i >= left ? split : 0)} y={i === left ? 0 : 6} width={w} height={i === left ? 54 : 48} rx="1" className={i === left ? 'hung' : undefined} />
      ))}
    </svg>
  )
}
