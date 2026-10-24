// 卦辭與爻辭的白話與占得提醒，可切換成只看原文。原文由外層顯示，這裡只管白話。
// 白話要顯示時才載入 lines.json，載入失敗時保留原文並提供重試；lines.json 沒有這一條時只顯示原文。

import { useEffect, useRef, useState } from 'react'
import { loadLines, type LinePlain as Entry } from '../data/lines.ts'

type View = 'original' | 'plain'
type Loaded = { key: string; status: 'ready'; entry: Entry | undefined } | { key: string; status: 'failed' }

interface Props {
  /** lines.json 的鍵，如 3-judgment、3-1、1-use */
  entryKey: string
  /** 經文出處，用在切換按鈕的無障礙名稱 */
  label: string
  /** 卡牌頁預設收合（只看原文），解讀頁預設顯示白話 */
  initial?: View
  /** 白話已渲染（或已確定載入失敗）時呼叫，讓深層連結在內容就位後才捲動 */
  onSettled?: () => void
}

export function LinePlain({ entryKey, label, initial = 'plain', onSettled }: Props) {
  const [view, setView] = useState<View>(initial)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [attempt, setAttempt] = useState(0)
  const open = view === 'plain'
  const current = loaded?.key === entryKey ? loaded : null
  const settledRef = useRef(onSettled)
  settledRef.current = onSettled

  useEffect(() => {
    if (!open) return
    let alive = true
    loadLines().then(
      data => { if (alive) setLoaded({ key: entryKey, status: 'ready', entry: data[entryKey] }) },
      () => { if (alive) setLoaded({ key: entryKey, status: 'failed' }) },
    )
    return () => { alive = false }
  }, [open, entryKey, attempt])

  const settled = open && current !== null
  useEffect(() => {
    if (settled) settledRef.current?.()
  }, [settled])

  const retry = () => {
    setLoaded(null)
    setAttempt(a => a + 1)
  }

  return (
    <div className="line-plain">
      <div className="segmented line-plain-toggle" role="group" aria-label={`${label}顯示方式`}>
        <button type="button" aria-pressed={!open} onClick={() => setView('original')}>原文</button>
        <button type="button" aria-pressed={open} onClick={() => setView('plain')}>白話</button>
      </div>
      {open && (
        <div className="line-plain-body" aria-live="polite">
          {current === null && <p className="note">白話載入中</p>}
          {current?.status === 'failed' && (
            <p className="note" role="alert">
              白話載入失敗，先顯示原文。
              <button type="button" className="btn" onClick={retry}>重試</button>
            </p>
          )}
          {current?.status === 'ready' && !current.entry && <p className="note">這段還沒有白話，先以原文為準。</p>}
          {current?.status === 'ready' && current.entry && (
            <>
              <p className="plain">{current.entry.plain}</p>
              <p className="plain-advice"><b>占得提醒</b>{current.entry.advice}</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
