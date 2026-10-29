import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { FocusText } from '../components/FocusText.tsx'
import { HexagramGlyph } from '../components/HexagramGlyph.tsx'
import { HoloCard } from '../components/holo/HoloCard.tsx'
import { LineForge } from '../components/LineForge.tsx'
import { LinePlain } from '../components/LinePlain.tsx'
import { rise } from '../components/rise.ts'
import { Scripture } from '../components/Scripture.tsx'
import artDirection from '../data/art-direction.json'
import { hasArt } from '../data/cards.ts'
import { textOf } from '../data/classic.ts'
import { content } from '../data/content.ts'
import { cuo, hexagram, hu, lineLabel, zong, type Hexagram } from '../data/hexagrams.ts'
import { lineKey, parseTextFocus, type TextFocus } from '../data/lines.ts'
import { xugua, zagua } from '../data/xugua.ts'
import { touch as touchCardCache } from '../app/cardCache.ts'
import { FLAGS } from '../app/flags.ts'
import { FavoriteButton, QuoteButton } from '../features/collection/index.ts'
import { ReviewToggle } from '../features/review/index.ts'
import { balancedPerColumn } from '../lib/columns.ts'
import { interpret } from '../lib/reading.ts'

type Tab = 'meaning' | 'text' | 'structure' | 'lab' | 'source'
const TABS: { id: Tab; label: string }[] = [
  { id: 'meaning', label: '牌義' },
  { id: 'text', label: '經文' },
  { id: 'structure', label: '卦象' },
  { id: 'lab', label: '爻變' },
  { id: 'source', label: '來源' },
]

const isTab = (v: string | null): v is Tab => TABS.some(t => t.id === v)

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
  const [dived, setDived] = useState(false)
  const [caption, setCaption] = useState('')
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const linkedTab = params.get('tab')
  const [tab, setTab] = useState<Tab>(isTab(linkedTab) ? linkedTab : 'meaning')
  const focus = tab === 'text' && linkedTab === 'text' ? parseTextFocus(params.get('focus'), n) : null
  const timer = useRef<number | undefined>(undefined)
  const keepCaption = useRef(false)
  const c = cuo(hex), z = zong(hex), x = hu(hex)

  // 這一卦的卡圖四層移到離線快取的最前面；背面的錯卦也會載入四層，一起記著才會在超過 30 卦時被清掉
  useEffect(() => { void touchCardCache(c.number).then(() => touchCardCache(n)) }, [n, c.number])

  // 換卦時回到正面、清空說明；只有倒轉、翻面或看互卦換來的卦保留那句說明
  useEffect(() => {
    setFlipped(false)
    setRolled(false)
    setDived(false)
    if (!keepCaption.current) setCaption('')
    keepCaption.current = false
    return () => window.clearTimeout(timer.current)
  }, [hex])

  const rollToZong = () => {
    window.clearTimeout(timer.current)
    setFlipped(false)
    setDived(false)
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
    setDived(false)
    setFlipped(true)
    setCaption(`翻到背面，六爻陰陽全部相反，就成了「${c.name}」。`)
    timer.current = window.setTimeout(() => {
      keepCaption.current = true
      setCaption(`這是「${hex.name}」翻面而成的錯卦「${c.name}」。`)
      navigate(`/gua/${c.number}`)
    }, 1700)
  }

  // 互卦沒有實體翻轉可對應，改成湊近看卦的中間四爻；乾、坤的互卦是自己，不提供這個按鈕
  const diveToHu = () => {
    window.clearTimeout(timer.current)
    setFlipped(false)
    setRolled(false)
    setDived(true)
    setCaption(`取中間四爻：二到四爻成下卦${x.lower.name}，三到五爻成上卦${x.upper.name}，合成「${x.name}」。`)
    timer.current = window.setTimeout(() => {
      keepCaption.current = true
      setCaption(`這是「${hex.name}」中間四爻合成的互卦「${x.name}」。`)
      navigate(`/gua/${x.number}`)
    }, 2200)
  }

  // 已在這一頁時再點到深層連結，也要切到指定分頁
  useEffect(() => {
    if (isTab(linkedTab)) setTab(linkedTab)
  }, [linkedTab, location.key])

  // 手動換分頁時清掉深層連結，回到經文分頁才不會又捲一次
  const chooseTab = (id: Tab) => {
    setTab(id)
    if (params.has('tab') || params.has('focus')) setParams({}, { replace: true })
  }

  return (
    <>
      <div className="detail">
        <section className="detail-stage rise" style={rise(0)}>
          <HoloCard
            front={n}
            back={{ kind: 'card', number: c.number }}
            flipped={flipped}
            rolled={rolled}
            dived={dived}
            onDoubleClick={flipToCuo}
            label={`${hex.fullName}卦牌，移動游標或拖曳可傾斜，雙擊翻面`}
          />
          <p className="stage-caption" aria-live="polite">{caption}</p>
          <div className="card-actions">
            <button className="btn" type="button" aria-pressed={rolled} onClick={rollToZong}>倒轉 <small>看綜卦</small></button>
            <button className="btn" type="button" aria-pressed={flipped} onClick={flipToCuo}>翻面 <small>看錯卦</small></button>
            {x !== hex && <button className="btn" type="button" aria-pressed={dived} onClick={diveToHu}>取中 <small>看互卦</small></button>}
          </div>
          {FLAGS.review && <ReviewToggle hexagram={n} />}
          <SequenceNav hex={hex} className="seq-nav-stage" />
        </section>

        <section className="detail-body rise" style={rise(1)}>
          <header className="detail-head">
            <div className="detail-title">
              <HexagramGlyph key={n} className="glyph grow" lines={hex.lines} />
              <h1>{hex.name}</h1>
              <div className="meta">第<b>{n}</b>卦・{hex.fullName}<br />{hex.upper.name}上{hex.lower.name}下・{n <= 30 ? '上經' : '下經'}</div>
              {FLAGS.collection && <FavoriteButton hexagram={n} label={`${hex.name}卦`} />}
            </div>
            <Scripture key={n} className="detail-classic" text={textOf(n).judgment} perColumn={balancedPerColumn(textOf(n).judgment, 4, 5, 9)} />
          </header>

          <div className="tabs" role="tablist">
            {TABS.map(t => (
              <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => chooseTab(t.id)}>{t.label}</button>
            ))}
          </div>
          <div className="panel" role="tabpanel">
            {tab === 'meaning' && <Meaning hex={hex} />}
            {tab === 'text' && <Classic key={location.key} hex={hex} focus={focus} />}
            {tab === 'structure' && <Structure hex={hex} />}
            {tab === 'lab' && <Lab hex={hex} />}
            {tab === 'source' && <Sources hex={hex} />}
          </div>
          {/* 900px 以下卡牌在上、內容在下，上一卦與下一卦改到讀完之後（規格「2026-10-29 介面檢視後修訂」） */}
          <SequenceNav hex={hex} className="seq-nav-foot" />
        </section>
      </div>
    </>
  )
}

function SequenceNav({ hex, className }: { hex: Hexagram; className: string }) {
  const prev = hex.number > 1 ? hexagram(hex.number - 1) : null
  const next = hex.number < 64 ? hexagram(hex.number + 1) : null
  return (
    <nav className={`seq-nav ${className}`} aria-label="序卦">
      {prev ? <Link to={`/gua/${prev.number}`}><b>← {prev.name}</b>{xugua[hex.number]}</Link> : <span />}
      {next ? <Link className="next" to={`/gua/${next.number}`}><b>{next.name} →</b>{xugua[next.number]}</Link> : <span />}
    </nav>
  )
}

function ArtNote({ hex }: { hex: Hexagram }) {
  const subject = artDirection.subjects[String(hex.number) as keyof typeof artDirection.subjects]
  return (
    <>
      <h2>卡面</h2>
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
  const t = textOf(hex.number)
  if (!c) {
    return (
      <>
        <h2>大象</h2>
        <p className="classic">{t.daxiang}</p>
        <h2>卦辭</h2>
        <p className="classic">{t.judgment}</p>
        <ArtNote hex={hex} />
        <p className="note">這一卦的白話導讀與牌義還在撰寫中，經文、卦象與爻變都已可查看。</p>
      </>
    )
  }
  return (
    <>
      <div className="chips">{c.keywords.map(k => <span key={k} className="chip">{k}</span>)}</div>
      <h2>整體牌義</h2>
      <p className="advice">{c.motto}</p>
      <p>{c.meaning}</p>
      <h2>白話導讀</h2>
      <p>{c.summary}</p>
      <h2>問事指引</h2>
      <dl className="guidance">
        <dt>事業與學業</dt><dd>{c.guidance.career}</dd>
        <dt>感情與人際</dt><dd>{c.guidance.relations}</dd>
        <dt>行動與決策</dt><dd>{c.guidance.decision}</dd>
      </dl>
      <h2>大象</h2>
      <p className="classic">{t.daxiang}</p>
      <ArtNote hex={hex} />
    </>
  )
}

const PLAIN_KEY = 'iching:text-plain'
const ALL_LINES = [0, 1, 2, 3, 4, 5]

function loadAllPlain() {
  try { return localStorage.getItem(PLAIN_KEY) === '1' } catch { return false }
}

/** 經文分頁。爻由上往下排，但 id 與白話的鍵一律用 classic 的原始索引（初爻為 0，乾坤的 6 為用九用六）。 */
function Classic({ hex, focus }: { hex: Hexagram; focus: TextFocus | null }) {
  const n = hex.number
  const t = textOf(n)
  const [flash, setFlash] = useState<TextFocus | null>(null)
  // 總開關：預設只看原文；切換時每一條的白話一起重設，偏好記在本機
  const [allPlain, setAllPlain] = useState(loadAllPlain)
  const chooseAll = (plain: boolean) => {
    setAllPlain(plain)
    try { localStorage.setItem(PLAIN_KEY, plain ? '1' : '0') } catch { /* 偏好記不住而已 */ }
  }
  const done = useRef(false)

  // 內容就位後才捲動，標示一陣子再淡掉；每次掛載只捲一次
  const reveal = useCallback(() => {
    if (!focus || done.current) return
    const el = document.getElementById(`text-${focus}`)
    if (!el) return
    done.current = true
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' })
    setFlash(focus)
  }, [focus])

  useEffect(() => {
    if (focus === 'daxiang') reveal()
  }, [focus, reveal])

  useEffect(() => {
    if (!flash) return
    const id = window.setTimeout(() => setFlash(null), 2400)
    return () => window.clearTimeout(id)
  }, [flash])

  const target = (id: TextFocus) => ({ id: `text-${id}`, 'data-flash': flash === id || undefined })
  const plainFor = (id: TextFocus, key: string, label: string) => (
    <LinePlain key={`${key}-${allPlain}`} entryKey={key} label={label} initial={focus === id || allPlain ? 'plain' : 'original'} onSettled={focus === id ? reveal : undefined} />
  )
  const order = t.lines.map((_, i) => i).reverse()

  return (
    <>
      <div className="segmented text-mode" role="group" aria-label="白話顯示方式">
        <button type="button" aria-pressed={!allPlain} onClick={() => chooseAll(false)}>只看原文</button>
        <button type="button" aria-pressed={allPlain} onClick={() => chooseAll(true)}>全部顯示白話</button>
      </div>
      <div className="text-target" {...target('judgment')}>
        <h2 className="with-quote">卦辭{FLAGS.collection && <QuoteButton quote={{ hexagram: n, kind: 'judgment' }} />}</h2>
        <p className="classic">{t.judgment}</p>
        {plainFor('judgment', lineKey(n, { kind: 'judgment' }), `${hex.name}卦辭`)}
      </div>
      <h2>彖傳</h2>
      <p>{t.tuan}</p>
      <div className="text-target" {...target('daxiang')}>
        <h2 className="with-quote">大象{FLAGS.collection && <QuoteButton quote={{ hexagram: n, kind: 'daxiang' }} />}</h2>
        <p>{t.daxiang}</p>
      </div>
      <h2>爻辭與小象</h2>
      <ul className="line-list">
        {order.map(i => {
          const l = t.lines[i]
          const id: TextFocus = i === 6 ? 'use' : `line-${i as 0 | 1 | 2 | 3 | 4 | 5}`
          const key = i === 6 ? lineKey(n, { kind: 'useAll' }) : lineKey(n, { kind: 'line', position: i })
          return (
            <li key={i} className="text-target" {...target(id)}>
              <HexagramGlyph className="glyph line-glyph" lines={hex.lines} moving={i === 6 ? ALL_LINES : [i]} />
              <span className="label">{l.label}{FLAGS.collection && <QuoteButton quote={i === 6 ? { hexagram: n, kind: 'useAll' } : { hexagram: n, kind: 'line', position: i }} />}</span>
              <span className="classic">{l.text}</span>
              <span className="xiang">象曰：{l.xiang}</span>
              {plainFor(id, key, `${hex.name}${l.label}`)}
            </li>
          )
        })}
      </ul>
      {t.wenyan.length > 0 && (
        <>
          <h2>文言</h2>
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
      <h2>相關卦</h2>
      <div className="relations">
        <Relation label="錯卦" hex={cuo(hex)} note="陰陽全變" />
        <Relation label="綜卦" hex={z} note={z === hex ? '上下對稱' : '上下顛倒'} />
        <Relation label="互卦" hex={hu(hex)} note="二至五爻" />
      </div>
      <h2>上下卦</h2>
      <dl className="kv">
        {[['上卦', hex.upper], ['下卦', hex.lower]].map(([label, t]) => {
          const tr = t as typeof hex.upper
          return [
            <dt key={`${label}`}>{label as string}</dt>,
            <dd key={`${label}-d`}>{tr.name}・{tr.image}　性{tr.nature}，為{tr.animal}、為{tr.body}，{tr.family}，{tr.direction}，五行屬{tr.element}</dd>,
          ]
        })}
      </dl>
      <h2>次序與歸屬</h2>
      <dl className="kv">
        <dt>文王卦序</dt><dd>第 {hex.number} 卦（{hex.number <= 30 ? '上經' : '下經'}）</dd>
        <dt>伏羲先天序</dt><dd>第 {hex.fuxi} 卦</dd>
        <dt>京房八宮</dt><dd>{hex.palace.trigram.name}宮{hex.palace.generation}・世在{lineLabel(hex.palace.shi - 1, hex.lines[hex.palace.shi - 1])}、應在{lineLabel(hex.palace.ying - 1, hex.lines[hex.palace.ying - 1])}・宮五行屬{hex.palace.trigram.element}</dd>
        {hex.month && <><dt>十二消息</dt><dd>{BRANCH_MONTH[hex.month]}</dd></>}
      </dl>
      <h2>序卦傳</h2>
      <p>{xugua[hex.number]}</p>
      <h2>雜卦傳</h2>
      <p>{zagua[hex.number]}</p>
    </>
  )
}

function Lab({ hex }: { hex: Hexagram }) {
  const [moving, setMoving] = useState<number[]>([])
  useEffect(() => setMoving([]), [hex])
  const reading = interpret(hex, moving)
  const toggle = (i: number) => setMoving(m => m.includes(i) ? m.filter(x => x !== i) : [...m, i])
  // 與起卦相同的爻位：變爻朱紅並標老陽圈、老陰叉，不變的爻標少陽、少陰
  const lines = hex.lines.map(bit => ({ bit, pressed: false, moving: false, note: bit ? '少陽' : '少陰' }))
  for (const i of moving) Object.assign(lines[i], { pressed: true, moving: true, note: hex.lines[i] ? '老陽' : '老陰' })
  return (
    <>
      <p className="note">點選任一爻讓它變動（老陽變陰、老陰變陽），右邊會出現變出來的之卦，並依朱熹《易學啟蒙》的規則標出該讀哪段經文。</p>
      <div className="lab">
        <LineForge
          className="lab-forge"
          lines={lines}
          label={`${hex.name}卦六爻`}
          onLine={toggle}
          lineLabel={i => `${lineLabel(i, hex.lines[i])}變動`}
          still
        />
        <div>
          <Link to={`/gua/${reading.result.number}`} className="relation lab-result">
            <small>{moving.length ? '之卦' : '不變'}</small>
            <HexagramGlyph lines={reading.result.lines} />
            <b>{reading.result.name}</b>
          </Link>
          <h2>讀法</h2>
          <p>{reading.rule}</p>
          {reading.focus.map((f, i) => <FocusText key={i} focus={f} main={i === 0} />)}
        </div>
      </div>
    </>
  )
}

function Sources({ hex }: { hex: Hexagram }) {
  return (
    <>
      <h2>經文</h2>
      <p>卦辭、爻辭、彖傳、象傳、文言、序卦與雜卦底本為王弼《周易注》。</p>
      <h2>八卦屬性</h2>
      <p>八卦的性情、動物、身體、家人取自《說卦傳》；方位為後天八卦方位；八宮世應依京房八宮推算。</p>
      <h2>卡面</h2>
      <p>
        {hasArt(hex.number)
          ? '插圖由 OpenAI Codex 的 image_gen 依本站撰寫的畫面描述生成，背景為上下卦的八卦紋樣面板拼合；卡框、文字、卦畫與朱印由程式以向量繪製，卦畫依卦象資料產生，不會出錯。'
          : '這一卦的插圖尚未繪製，目前顯示的是卡框、文字與八卦面板的佔位版本。'}
      </p>
      <h2>白話導讀</h2>
      <p>導讀、問事指引與牌義為本站原創，是協助理解的現代說法，經文仍以原文為準。</p>
    </>
  )
}
