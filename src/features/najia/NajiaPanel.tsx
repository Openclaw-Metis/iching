// 納甲六爻盤（規格「納甲六爻盤」）：同一卦在京房納甲法裡的排法，只排盤、不判吉凶。
// 月建與日辰預設由起卦時間換算，使用者可以改；改動只留在畫面上，不保存。

import { useMemo, useState } from 'react'
import { toast } from '../../app/toast.ts'
import { hexagramsOf, type LineValue } from '../../lib/castLines.ts'
import { formatDateTime } from '../../lib/dates.ts'
import { BRANCHES, castTime, ganzhiName } from '../../lib/ganzhi.ts'
import { najia, yaoGanzhi, type NajiaYao } from '../../lib/najia.ts'
import { chartText } from './chartText.ts'

interface Props {
  /** 六個爻值，初爻在前 */
  lines: readonly LineValue[]
  /** 起卦時間（ISO） */
  castAt: string
  /** 占卜的問題；有才出現「附上我的問題」 */
  question?: string
}

const ORDINAL = ['初', '二', '三', '四', '五', '上']
const DAYS = Array.from({ length: 60 }, (_, i) => i)

function Marks({ yao }: { yao: NajiaYao }) {
  return (
    <>
      {yao.void && <em className="najia-mark">旬空</em>}
      {yao.monthBreak && <em className="najia-mark">月破</em>}
      {yao.dayClash && <em className="najia-mark">日沖</em>}
    </>
  )
}

function Yao({ yao }: { yao: NajiaYao }) {
  return <><b>{yao.relation}</b> {yaoGanzhi(yao)}{yao.element}</>
}

export function NajiaPanel({ lines, castAt, question = '' }: Props) {
  const cast = useMemo(() => castTime(new Date(castAt)), [castAt])
  const [month, setMonth] = useState(cast.month)
  const [day, setDay] = useState(cast.day)
  const edited = month !== cast.month || day !== cast.day
  const chart = useMemo(() => {
    const { primary, moving } = hexagramsOf(lines)
    return najia(primary, moving, { month, day })
  }, [lines, month, day])
  const { primary, palace } = chart
  const [withQuestion, setWithQuestion] = useState(false)
  const [withPrompt, setWithPrompt] = useState(false)
  // 剪貼簿不能用時改顯示可手動選取的文字
  const [manual, setManual] = useState(false)
  const hasQuestion = question.trim().length > 0
  const text = chartText(chart, { month, day }, {
    castAtLabel: edited ? undefined : formatDateTime(castAt),
    question: withQuestion ? question : undefined,
    withPrompt,
  })
  const copy = () => {
    const done = navigator.clipboard?.writeText(text)
    if (!done) return setManual(true)
    void done.then(() => { setManual(false); toast('已複製排盤') }, () => setManual(true))
  }
  const pure = palace.name === primary.name ? null : `${palace.name}為${palace.image}`

  return (
    <div className="najia">
      <p>
        {primary.fullName}屬{palace.name}宮{primary.palace.generation === '本宮' ? '首卦' : `${primary.palace.generation}卦`}，宮的五行是{palace.element}，六親依它來定。
        {chart.missing.length > 0 && pure && `本卦六爻沒有${chart.missing.join('、')}，從本宮首卦${pure}取伏神。`}
      </p>

      <div className="najia-time">
        <label>
          月建
          <select value={month} onChange={e => setMonth(Number(e.target.value))}>
            {[...BRANCHES].map((b, i) => <option key={b} value={i}>{b}月</option>)}
          </select>
        </label>
        <label>
          日辰
          <select value={day} onChange={e => setDay(Number(e.target.value))}>
            {DAYS.map(i => <option key={i} value={i}>{ganzhiName(i)}日</option>)}
          </select>
        </label>
        <span>旬空：{chart.voidBranches?.map(b => BRANCHES[b]).join('')}</span>
        {edited && <button type="button" className="btn" onClick={() => { setMonth(cast.month); setDay(cast.day) }}>回到起卦時間</button>}
      </div>
      <p className="note">
        {edited ? '已改成你選的月建與日辰，只在這個畫面有效。' : `依起卦時間 ${formatDateTime(castAt)} 換算。`}
        {cast.nearTerm && !edited && '這個時刻離交節不到一小時，月建可能差一個月，請對照曆書。'}
      </p>

      <ol className="najia-lines" aria-label="納甲六爻，由上爻到初爻">
        {[...chart.lines].reverse().map(line => (
          <li key={line.position} data-bit={line.bit} data-moving={line.moving || undefined}>
            <span className="najia-ord">{ORDINAL[line.position]}<span className="sr-only">爻，{line.bit ? '陽' : '陰'}{line.moving ? '，變爻' : ''}</span></span>
            <span className="najia-spirit">{line.spirit}</span>
            <span className="najia-bar" aria-hidden="true" />
            <span className="najia-main">
              <Yao yao={line} />
              {line.shi && <i className="najia-seat">世</i>}
              {line.ying && <i className="najia-seat">應</i>}
              <Marks yao={line} />
            </span>
            {line.changed && <span className="najia-sub"><small>化</small><Yao yao={line.changed} /><Marks yao={line.changed} /></span>}
            {line.hidden && <span className="najia-sub"><small>伏</small><Yao yao={line.hidden} /><Marks yao={line.hidden} /></span>}
          </li>
        ))}
      </ol>

      <div className="najia-copy">
        <button type="button" className="btn" onClick={copy}>複製排盤</button>
        {hasQuestion && (
          <label><input type="checkbox" checked={withQuestion} onChange={e => setWithQuestion(e.target.checked)} />附上我的問題</label>
        )}
        <label><input type="checkbox" checked={withPrompt} onChange={e => setWithPrompt(e.target.checked)} />附上給 AI 的提問</label>
      </div>
      {manual && (
        <label className="najia-manual">
          這個瀏覽器不讓網站寫入剪貼簿，請自己選取下面的文字複製。
          <textarea readOnly rows={12} value={text} onFocus={e => e.currentTarget.select()} />
        </label>
      )}
      <p className="note">
        複製的是這個盤面的純文字，可以貼進筆記或拿去問人。勾選「附上給 AI 的提問」後可以貼給你自己使用的 AI：解讀出自那個 AI，本站沒有參與，也不保證正確{hasQuestion && '；勾了「附上我的問題」，問題文字會跟著貼過去'}。
      </p>

      <p className="note">
        這裡只排盤，不判吉凶。月建依節氣換月（立春起寅月），晚上 11 點後算次日的日辰。「化」是變爻變出來的爻，「伏」是伏在這一爻底下的伏神；日沖只標出與日辰相沖。
      </p>
    </div>
  )
}
