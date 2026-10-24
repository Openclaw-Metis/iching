import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { FLAGS } from '../app/flags.ts'
import { CardThumb, type Relation } from '../components/CardThumb.tsx'
import { HexagramGlyph } from '../components/HexagramGlyph.tsx'
import { textOf } from '../data/classic.ts'
import { cuo, hexagram, hexagrams, hu, zong, type Hexagram, type PalaceGeneration } from '../data/hexagrams.ts'
import { trigrams } from '../data/trigrams.ts'

type View = 'kingwen' | 'matrix' | 'palace' | 'months'
const VIEWS: { id: View; label: string; note: string }[] = [
  { id: 'kingwen', label: '文王卦序', note: '依通行本《周易》的卦序排列，上經三十卦從乾到離，下經三十四卦從咸到未濟。卦序兩兩成對，相鄰兩卦不是上下顛倒的綜卦，就是陰陽全變的錯卦。' },
  { id: 'matrix', label: '上下卦', note: '以上卦為列、下卦為行排成八乘八。每張卦牌的背景由上卦與下卦拼成，所以同一列上半相同、同一行下半相同，對角線是上下相同的八純卦。' },
  { id: 'palace', label: '京房八宮', note: '漢代京房以八純卦為宮首，從初爻起逐爻變出一世到五世卦，再變回第四爻為遊魂、下卦復原為歸魂，每宮八卦同屬宮首的五行。' },
  { id: 'months', label: '十二消息', note: '十二個月各配一卦：十一月冬至的復卦一陽初生，陽爻逐月增長到四月的乾卦；五月姤卦一陰始生，陰爻再逐月增長到十月的坤卦。' },
]

const PALACE_ORDER = ['乾', '震', '坎', '艮', '坤', '巽', '離', '兌']
const GENERATIONS: PalaceGeneration[] = ['本宮', '一世', '二世', '三世', '四世', '五世', '遊魂', '歸魂']
// 十二消息卦依月份排列，復為十一月（子）
const MONTH_ORDER = [24, 19, 11, 34, 43, 1, 44, 33, 12, 20, 23, 2]
const MONTH_NAMES = ['十一月', '十二月', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月']
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'
const MAP_KEY = 'iching:map-overlay'

type MapCells = Map<number, { opacity: number; due: boolean }>
type MapView = { cells: MapCells; dueCount: number } | null

function loadMapOn(): boolean {
  // 溫故關閉時不理會記住的開關，卦殿不載入溫故模組
  if (!FLAGS.review) return false
  try { return localStorage.getItem(MAP_KEY) === '1' } catch { return false }
}

/**
 * 學習地圖：預設關閉。開啟時才以 import() 載入溫故模組（含 ts-fsrs 與保存層），卦殿首屏不帶這些程式。
 * 溫故卡有變動（作答、加入、移出、另一個分頁）時重算亮度。
 */
function useLearningMap(on: boolean): { map: MapView; failed: boolean } {
  const [map, setMap] = useState<MapView>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!on) {
      setMap(null)
      return
    }
    let stop = () => {}
    let alive = true
    setFailed(false)
    import('../features/review/index.ts').then(
      m => { if (alive) stop = m.watchMap(s => setMap({ cells: s.cells, dueCount: s.dueCount })) },
      () => { if (alive) setFailed(true) },
    )
    return () => {
      alive = false
      stop()
    }
  }, [on])
  return { map, failed }
}

export function Hall() {
  const [view, setView] = useState<View>('kingwen')
  const [query, setQuery] = useState('')
  const [focus, setFocus] = useState<Hexagram | null>(null)
  const [mapOn, setMapOn] = useState(loadMapOn)
  const { map, failed } = useLearningMap(mapOn)
  const toggleMap = () => {
    const next = !mapOn
    setMapOn(next)
    try { localStorage.setItem(MAP_KEY, next ? '1' : '0') } catch { /* 偏好記不住而已 */ }
  }

  const matches = useMemo(() => {
    const q = query.trim()
    if (!q) return null
    return new Set(hexagrams.filter(h => h.fullName.includes(q) || String(h.number) === q).map(h => h.number))
  }, [query])

  const relations = useMemo(() => {
    const map = new Map<number, Relation[]>()
    if (!focus) return map
    const add = (h: Hexagram, r: Relation) => { if (h !== focus) map.set(h.number, [...(map.get(h.number) ?? []), r]) }
    add(cuo(focus), 'cuo'); add(zong(focus), 'zong'); add(hu(focus), 'hu')
    return map
  }, [focus])

  const thumb = (h: Hexagram) => (
    <CardThumb key={h.number} hex={h} relation={relations.get(h.number)} dim={matches ? !matches.has(h.number) : false} map={map?.cells.get(h.number)} onFocus={setFocus} />
  )

  return (
    <>
      <section className="hall-intro">
        <h1>六十四卦殿</h1>
        {/* 四段說明疊在同一格，高度取最長的一段，切換排列時下方按鈕不會跳動 */}
        <div className="view-notes" aria-live="polite">
          {VIEWS.map(v => <p key={v.id} className={v.id === view ? undefined : 'off'} aria-hidden={v.id !== view}>{v.note}</p>)}
        </div>
      </section>

      <div className="hall-controls">
        <div className="segmented" role="group" aria-label="排列方式">
          {VIEWS.map(v => <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)}>{v.label}</button>)}
        </div>
        <input className="search" type="search" placeholder="搜尋卦名或卦序" value={query} onChange={e => setQuery(e.target.value)} aria-label="搜尋卦名或卦序" />
        {FLAGS.review && <button type="button" className="btn map-toggle" aria-pressed={mapOn} onClick={toggleMap}>學習地圖</button>}
      </div>
      {mapOn && (
        <p className="map-status" aria-live="polite">
          {failed ? '學習地圖載入失敗，請重新整理再試。'
            : !map ? '學習地圖載入中'
              : <>待溫 {map.dueCount} 張・越亮表示記得越牢，淡墨灰階是還沒學過的卦。{map.dueCount > 0 && <Link to="/academy/review">去溫故</Link>}</>}
        </p>
      )}
      <div className="legend" aria-hidden="true"><span className="l-cuo">錯卦：陰陽全變</span><span className="l-zong">綜卦：上下顛倒</span><span className="l-hu">互卦：取中間四爻</span></div>

      {view === 'kingwen' && <div className="hall-grid">{hexagrams.map(thumb)}</div>}

      {view === 'matrix' && (
        <div className="matrix-wrap">
          <div className="matrix">
            <div className="axis axis-corner">上卦 ↓<br />下卦 →</div>
            {trigrams.map(t => <Axis key={t.id} name={t.name} image={t.image} color={t.color} />)}
            {trigrams.map(up => [
              <Axis key={up.id} name={up.name} image={up.image} color={up.color} />,
              ...trigrams.map(low => thumb(hexagrams.find(h => h.upper === up && h.lower === low)!)),
            ])}
          </div>
        </div>
      )}

      {view === 'palace' && (
        <div className="matrix-wrap">
          <div className="matrix">
            <div className="axis axis-corner">宮 ↓<br />世 →</div>
            {GENERATIONS.map(g => <div key={g} className="axis"><b>{g}</b></div>)}
            {PALACE_ORDER.map(p => {
              const t = trigrams.find(tr => tr.name === p)!
              return [
                <Axis key={p} name={`${p}宮`} image={t.element} color={t.color} />,
                ...GENERATIONS.map(g => thumb(hexagrams.find(h => h.palace.trigram === t && h.palace.generation === g)!)),
              ]
            })}
          </div>
        </div>
      )}

      {view === 'months' && (
        <div className="months">
          {MONTH_ORDER.map((n, i) => (
            <div key={n}>
              {thumb(hexagram(n))}
              <div className="month-label"><b>{MONTH_NAMES[i]}</b>・{BRANCHES[i]}　陽爻 {hexagram(n).lines.filter(Boolean).length}</div>
            </div>
          ))}
        </div>
      )}

      <Spotlight focus={focus} />
    </>
  )
}

function Axis({ name, image, color }: { name: string; image: string; color: string }) {
  return (
    <div className="axis">
      <b>{name}</b>
      <span>{image}</span>
      <span className="swatch" style={{ background: color }} />
    </div>
  )
}

function Spotlight({ focus }: { focus: Hexagram | null }) {
  if (!focus) {
    return (
      <aside className="spotlight" aria-live="polite">
        <p className="hint-hover">把游標移到卦牌上，它的錯卦、綜卦、互卦會一起亮起。點一下卦牌，打開詳細頁。</p>
        <p className="hint-touch">點一下卦牌，打開詳細頁，可以傾斜、倒轉看綜卦、翻面看錯卦。</p>
      </aside>
    )
  }
  const c = cuo(focus), z = zong(focus), x = hu(focus)
  return (
    <aside className="spotlight" aria-live="polite">
      <HexagramGlyph lines={focus.lines} />
      <div>
        <h2>{focus.name}<small>{focus.fullName}・第{focus.number}卦</small></h2>
        <p>{textOf(focus.number).judgment}</p>
      </div>
      <div className="rels">錯 {c.name}<br />綜 {z === focus ? '（自身）' : z.name}<br />互 {x.name}</div>
    </aside>
  )
}
