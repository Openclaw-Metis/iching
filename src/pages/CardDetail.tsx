import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { HexagramGlyph } from '../components/HexagramGlyph.tsx'
import { HoloCard } from '../components/holo/HoloCard.tsx'
import artDirection from '../data/art-direction.json'
import classic from '../data/classic.json'
import { hasArt } from '../data/cards.ts'
import { content } from '../data/content.ts'
import { cuo, hexagram, hu, lineLabel, zong, type Hexagram } from '../data/hexagrams.ts'
import { xugua, zagua } from '../data/xugua.ts'
import { interpret, type ReadingFocus } from '../lib/reading.ts'

type Tab = 'meaning' | 'text' | 'structure' | 'lab' | 'source'
const TABS: { id: Tab; label: string }[] = [
  { id: 'meaning', label: '牌義' },
  { id: 'text', label: '經文' },
  { id: 'structure', label: '卦象' },
  { id: 'lab', label: '爻變' },
  { id: 'source', label: '來源' },
]

const textOf = (h: Hexagram) => classic.hexagrams[h.number - 1]

export function CardDetail() {
  const { number } = useParams()
  const n = Number(number)
  if (!Number.isInteger(n) || n < 1 || n > 64) {
    return <p className="note" style={{ textAlign: 'center', marginTop: 48 }}>沒有這一卦。<Link to="/">回到卦殿</Link></p>
  }
  return <Detail n={n} />
}

function Detail({ n }: { n: number }) {
  const hex = hexagram(n)
  const navigate = useNavigate()
  const [flipped, setFlipped] = useState(false)
  const [rolled, setRolled] = useState(false)
  const [caption, setCaption] = useState('')
  const [tab, setTab] = useState<Tab>('meaning')
  const timer = useRef<number | undefined>(undefined)
  const keepCaption = useRef(false)
  const c = cuo(hex), z = zong(hex)

  // 換卦時回到正面、清空說明；只有倒轉或翻面換來的卦保留那句說明
  useEffect(() => {
    setFlipped(false)
    setRolled(false)
    if (!keepCaption.current) setCaption('')
    keepCaption.current = false
    document.title = `${hex.name}・${hex.fullName}｜易經卦殿`
    return () => window.clearTimeout(timer.current)
  }, [hex])

  const rollToZong = () => {
    window.clearTimeout(timer.current)
    setFlipped(false)
    if (z === hex) {
      setRolled(r => !r)
      setCaption(`「${hex.name}」上下對稱，倒轉過來仍是自己。`)
      return
    }
    setRolled(true)
    setCaption(`倒轉過來，六爻由下而上讀，就成了「${z.name}」。`)
    timer.current = window.setTimeout(() => {
      keepCaption.current = true
      setCaption(`這是「${hex.name}」倒轉而成的綜卦「${z.name}」。`)
      navigate(`/gua/${z.number}`)
    }, 1700)
  }

  // 與倒轉相同：先讓人看到背面的錯卦，再換到那一卦的頁面
  const flipToCuo = () => {
    window.clearTimeout(timer.current)
    setRolled(false)
    setFlipped(true)
    setCaption(`翻到背面，六爻陰陽全部相反，就成了「${c.name}」。`)
    timer.current = window.setTimeout(() => {
      keepCaption.current = true
      setCaption(`這是「${hex.name}」翻面而成的錯卦「${c.name}」。`)
      navigate(`/gua/${c.number}`)
    }, 1700)
  }

  return (
    <>
      <Link className="back-link" to="/">← 回到卦殿</Link>
      <div className="detail">
        <section className="detail-stage">
          <HoloCard
            front={n}
            back={{ kind: 'card', number: c.number }}
            flipped={flipped}
            rolled={rolled}
            onDoubleClick={flipToCuo}
            label={`${hex.fullName}卦牌，移動游標或拖曳可傾斜，雙擊翻面`}
          />
          <p className="stage-caption" aria-live="polite">{caption}</p>
          <div className="card-actions">
            <button className="btn" type="button" aria-pressed={rolled} onClick={rollToZong}>倒轉 <small>看綜卦</small></button>
            <button className="btn" type="button" aria-pressed={flipped} onClick={flipToCuo}>翻面 <small>看錯卦</small></button>
          </div>
          <SequenceNav hex={hex} />
        </section>

        <section>
          <header className="detail-head">
            <HexagramGlyph lines={hex.lines} />
            <div>
              <h1>{hex.name}</h1>
              <div className="meta">第<b>{n}</b>卦・{hex.fullName}・{hex.upper.name}上{hex.lower.name}下・{n <= 30 ? '上經' : '下經'}</div>
            </div>
          </header>

          <div className="tabs" role="tablist">
            {TABS.map(t => (
              <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>
          <div className="panel" role="tabpanel">
            {tab === 'meaning' && <Meaning hex={hex} />}
            {tab === 'text' && <Classic hex={hex} />}
            {tab === 'structure' && <Structure hex={hex} />}
            {tab === 'lab' && <Lab hex={hex} />}
            {tab === 'source' && <Sources hex={hex} />}
          </div>
        </section>
      </div>
    </>
  )
}

function SequenceNav({ hex }: { hex: Hexagram }) {
  const prev = hex.number > 1 ? hexagram(hex.number - 1) : null
  const next = hex.number < 64 ? hexagram(hex.number + 1) : null
  return (
    <nav className="seq-nav" aria-label="序卦">
      {prev ? <Link to={`/gua/${prev.number}`}><b>← {prev.name}</b>{xugua[hex.number]}</Link> : <span />}
      {next ? <Link className="next" to={`/gua/${next.number}`}><b>{next.name} →</b>{xugua[next.number]}</Link> : <span />}
    </nav>
  )
}

function ArtNote({ hex }: { hex: Hexagram }) {
  const subject = artDirection.subjects[String(hex.number) as keyof typeof artDirection.subjects]
  return (
    <>
      <h3>卡面</h3>
      <p className="note">
        {subject?.zh}
        {hex.upper === hex.lower
          ? `背景上下兩半都是${hex.upper.image}（${hex.upper.name}）的紋樣面板。`
          : `背景上半是${hex.upper.image}（${hex.upper.name}）的紋樣面板，下半是${hex.lower.image}（${hex.lower.name}）的紋樣面板。`}
      </p>
    </>
  )
}

function Meaning({ hex }: { hex: Hexagram }) {
  const c = content[hex.number]
  const t = textOf(hex)
  if (!c) {
    return (
      <>
        <h3>大象</h3>
        <p className="classic">{t.daxiang}</p>
        <h3>卦辭</h3>
        <p className="classic">{t.judgment}</p>
        <ArtNote hex={hex} />
        <p className="note">這一卦的白話導讀與牌義還在撰寫中，經文、卦象與爻變都已可查看。</p>
      </>
    )
  }
  return (
    <>
      <div className="chips">{c.keywords.map(k => <span key={k} className="chip">{k}</span>)}</div>
      <p className="advice">{c.advice}</p>
      <h3>白話導讀</h3>
      <p>{c.summary}</p>
      <h3>問事指引</h3>
      <p>{c.guidance}</p>
      <h3>大象</h3>
      <p className="classic">{t.daxiang}</p>
      <ArtNote hex={hex} />
    </>
  )
}

function Classic({ hex }: { hex: Hexagram }) {
  const t = textOf(hex)
  return (
    <>
      <h3>卦辭</h3>
      <p className="classic">{t.judgment}</p>
      <h3>彖傳</h3>
      <p>{t.tuan}</p>
      <h3>大象</h3>
      <p>{t.daxiang}</p>
      <h3>爻辭與小象</h3>
      <ul className="line-list">
        {[...t.lines].reverse().map(l => (
          <li key={l.label}>
            <span className="label">{l.label}</span>
            <span className="classic">{l.text}</span>
            <span className="xiang">象曰：{l.xiang}</span>
          </li>
        ))}
      </ul>
      {t.wenyan.length > 0 && (
        <>
          <h3>文言</h3>
          {t.wenyan.map((p, i) => <p key={i}>{p}</p>)}
        </>
      )}
      {'notes' in t && Array.isArray(t.notes) && <p className="note">校勘：{t.notes.join('；')}</p>}
    </>
  )
}

function Relation({ label, hex, note }: { label: string; hex: Hexagram; note: string }) {
  return (
    <Link className="relation" to={`/gua/${hex.number}`}>
      <small>{label}</small>
      <HexagramGlyph lines={hex.lines} />
      <b>{hex.name}</b>
      <small>{note}</small>
    </Link>
  )
}

function Structure({ hex }: { hex: Hexagram }) {
  const z = zong(hex)
  const BRANCH_MONTH: Record<number, string> = { 11: '十一月（子）', 12: '十二月（丑）', 1: '正月（寅）', 2: '二月（卯）', 3: '三月（辰）', 4: '四月（巳）', 5: '五月（午）', 6: '六月（未）', 7: '七月（申）', 8: '八月（酉）', 9: '九月（戌）', 10: '十月（亥）' }
  return (
    <>
      <h3>相關卦</h3>
      <div className="relations">
        <Relation label="錯卦" hex={cuo(hex)} note="陰陽全變" />
        <Relation label="綜卦" hex={z} note={z === hex ? '上下對稱' : '上下顛倒'} />
        <Relation label="互卦" hex={hu(hex)} note="二至五爻" />
      </div>
      <h3>上下卦</h3>
      <dl className="kv">
        {[['上卦', hex.upper], ['下卦', hex.lower]].map(([label, t]) => {
          const tr = t as typeof hex.upper
          return [
            <dt key={`${label}`}>{label as string}</dt>,
            <dd key={`${label}-d`}>{tr.name}・{tr.image}　性{tr.nature}，為{tr.animal}、為{tr.body}，{tr.family}，{tr.direction}，五行屬{tr.element}</dd>,
          ]
        })}
      </dl>
      <h3>次序與歸屬</h3>
      <dl className="kv">
        <dt>文王卦序</dt><dd>第 {hex.number} 卦（{hex.number <= 30 ? '上經' : '下經'}）</dd>
        <dt>伏羲先天序</dt><dd>第 {hex.fuxi} 卦</dd>
        <dt>京房八宮</dt><dd>{hex.palace.trigram.name}宮{hex.palace.generation}・世在{lineLabel(hex.palace.shi - 1, hex.lines[hex.palace.shi - 1])}、應在{lineLabel(hex.palace.ying - 1, hex.lines[hex.palace.ying - 1])}・宮五行屬{hex.palace.trigram.element}</dd>
        {hex.month && <><dt>十二消息</dt><dd>{BRANCH_MONTH[hex.month]}</dd></>}
      </dl>
      <h3>序卦傳</h3>
      <p>{xugua[hex.number]}</p>
      <h3>雜卦傳</h3>
      <p>{zagua[hex.number]}</p>
    </>
  )
}

function Lab({ hex }: { hex: Hexagram }) {
  const [moving, setMoving] = useState<number[]>([])
  useEffect(() => setMoving([]), [hex])
  const reading = interpret(hex, moving)
  const toggle = (i: number) => setMoving(m => m.includes(i) ? m.filter(x => x !== i) : [...m, i])
  return (
    <>
      <p className="note">點選任一爻讓它變動（老陽變陰、老陰變陽），右邊會出現變出來的之卦，並依朱熹《易學啟蒙》的規則標出該讀哪段經文。</p>
      <div className="lab">
        <div className="lab-lines">
          {[5, 4, 3, 2, 1, 0].map(i => (
            <button key={i} type="button" className="lab-line" aria-pressed={moving.includes(i)} onClick={() => toggle(i)}>
              <span>{lineLabel(i, hex.lines[i])}</span>
              <i data-bit={hex.lines[i]} />
            </button>
          ))}
        </div>
        <div>
          <div className="lab-result">
            <HexagramGlyph lines={hex.lines} moving={moving} />
            <span className="arrow">→</span>
            <Link to={`/gua/${reading.result.number}`} className="relation" style={{ padding: '8px 14px' }}>
              <HexagramGlyph lines={reading.result.lines} />
              <b>{reading.result.name}</b>
              <small>{moving.length ? '之卦' : '不變'}</small>
            </Link>
          </div>
          <h3>讀法</h3>
          <p>{reading.rule}</p>
          {reading.focus.map((f, i) => <FocusText key={i} focus={f} main={i === 0} />)}
        </div>
      </div>
    </>
  )
}

function FocusText({ focus, main }: { focus: ReadingFocus; main: boolean }) {
  const t = textOf(focus.hexagram)
  const tag = main ? '主' : '輔'
  if (focus.kind === 'judgment') return <p className="classic">〔{tag}〕{focus.hexagram.name}卦辭：{t.judgment}</p>
  if (focus.kind === 'useAll') {
    const use = t.lines[6]
    return <p className="classic">〔{tag}〕{use.label}：{use.text}</p>
  }
  const line = t.lines[focus.position]
  return <p className="classic">〔{tag}〕{focus.hexagram.name}{line.label}：{line.text}</p>
}

function Sources({ hex }: { hex: Hexagram }) {
  return (
    <>
      <h3>經文</h3>
      <p>卦辭、爻辭、彖傳、象傳、文言、序卦與雜卦底本為王弼《周易注》。</p>
      <h3>八卦屬性</h3>
      <p>八卦的性情、動物、身體、家人取自《說卦傳》；方位為後天八卦方位；八宮世應依京房八宮推算。</p>
      <h3>卡面</h3>
      <p>
        {hasArt(hex.number)
          ? '插圖由 OpenAI Codex 的 image_gen 依本站撰寫的畫面描述生成，背景為上下卦的八卦紋樣面板拼合；卡框、文字、卦畫與朱印由程式以向量繪製，卦畫依卦象資料產生，不會出錯。'
          : '這一卦的插圖尚未繪製，目前顯示的是卡框、文字與八卦面板的佔位版本。'}
      </p>
      <h3>白話導讀</h3>
      <p>導讀、問事指引與牌義為本站原創，是協助理解的現代說法，經文仍以原文為準。</p>
    </>
  )
}
