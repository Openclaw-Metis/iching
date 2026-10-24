// 流程步驟導覽：已完成的步驟可以點開回看摘要（由 onSelect 決定顯示什麼），不能回頭修改。

interface Props {
  steps: string[]
  current: number
  label: string
  onSelect?: (index: number) => void
}

export function Stepper({ steps, current, label, onSelect }: Props) {
  return (
    <ol className="stepper" aria-label={label}>
      {steps.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo'
        return (
          <li key={step} data-state={state} aria-current={i === current ? 'step' : undefined}>
            {state === 'done' && onSelect
              ? <button type="button" onClick={() => onSelect(i)}><i aria-hidden="true">✓</i>{step}<span className="sr-only">（已完成，點開回看）</span></button>
              : <span><i aria-hidden="true">{state === 'done' ? '✓' : i + 1}</i>{step}</span>}
          </li>
        )
      })}
    </ol>
  )
}
