type Point = readonly [number, number]
type DotGroup = { value: number; x: number; y: number; points?: readonly Point[] }

const PATTERNS: Record<number, readonly Point[]> = {
  1: [[0, 0]],
  2: [[-5, 0], [5, 0]],
  3: [[-9, 0], [0, 0], [9, 0]],
  4: [[-5, -5], [5, -5], [-5, 5], [5, 5]],
  5: [[0, -9], [-9, 0], [0, 0], [9, 0], [0, 9]],
  6: [[-5, -9], [5, -9], [-5, 0], [5, 0], [-5, 9], [5, 9]],
  7: [[-9, -9], [0, -9], [9, -9], [0, 0], [-9, 9], [0, 9], [9, 9]],
  8: [[-9, -9], [0, -9], [9, -9], [-9, 0], [9, 0], [-9, 9], [0, 9], [9, 9]],
  9: [[-9, -9], [0, -9], [9, -9], [-9, 0], [0, 0], [9, 0], [-9, 9], [0, 9], [9, 9]],
}

// 上南下北、左東右西。中宮十點圍住五點，保留生成數的配對。
const HETU: readonly DotGroup[] = [
  { value: 7, x: 120, y: 25 }, { value: 2, x: 120, y: 67 },
  { value: 8, x: 25, y: 120 }, { value: 3, x: 67, y: 120 },
  { value: 4, x: 173, y: 120 }, { value: 9, x: 215, y: 120 },
  { value: 1, x: 120, y: 173 }, { value: 6, x: 120, y: 215 },
  { value: 5, x: 120, y: 120 },
  { value: 10, x: 120, y: 120, points: [[-24, -24], [0, -24], [24, -24], [-24, -8], [24, -8], [-24, 8], [24, 8], [-24, 24], [0, 24], [24, 24]] },
]

const LUOSHU: readonly DotGroup[] = [
  [4, 9, 2], [3, 5, 7], [8, 1, 6],
].flatMap((row, y) => row.map((value, x) => ({ value, x: 42 + x * 78, y: 42 + y * 78 })))

function DotDiagram({ groups, name }: { groups: readonly DotGroup[]; name: string }) {
  return (
    <figure>
      <svg viewBox="0 0 240 240" aria-hidden="true" data-diagram={name}>
        {groups.map(group => (
          <g key={group.value} data-value={group.value} className={group.value % 2 ? 'diagram-yang' : 'diagram-yin'} transform={`translate(${group.x} ${group.y})`}>
            {(group.points ?? PATTERNS[group.value]).map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.2} />)}
          </g>
        ))}
      </svg>
      <figcaption>{name === 'hetu' ? '河圖' : '洛書'}</figcaption>
    </figure>
  )
}

export function HetuLuoshu() {
  return (
    <aside className="today-symbols" aria-label="河圖與洛書意象">
      <DotDiagram groups={HETU} name="hetu" />
      <DotDiagram groups={LUOSHU} name="luoshu" />
    </aside>
  )
}
