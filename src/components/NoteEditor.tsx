// 筆記與事後回顧：停止輸入 800 ms 後自動保存。保存失敗或另一個分頁改過時，剛輸入的文字留在框裡，
// 由使用者自己決定要不要再存一次。
// 保存時帶的是「開始這次編輯時」看到的版本（rev），不是即時訂閱更新後的版本：
// 編輯途中另一個分頁先存了，這次保存就會收到衝突，而不是默默蓋掉對方的內容。

import { useEffect, useId, useRef, useState } from 'react'
import { ERROR_MESSAGES, isAppError } from '../lib/errors.ts'

interface Props {
  label: string
  value: string
  /** 內容的版本（rev）；保存時把開始編輯時的版本交給 onSave */
  version?: number
  placeholder?: string
  maxLength?: number
  autoFocus?: boolean
  /** 保存成功時回傳新的版本 */
  onSave: (text: string, version?: number) => Promise<number | void>
}

type Status = 'idle' | 'saving' | 'saved' | 'error'

const len = (s: string) => [...s].length

export function NoteEditor({ label, value, version, placeholder, maxLength = 2000, autoFocus = false, onSave }: Props) {
  const [text, setText] = useState(value)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latest = useRef(text)
  const saveRef = useRef(onSave)
  saveRef.current = onSave
  // 這次編輯的起點版本；null 代表下一次輸入時再取當下的版本
  const base = useRef<number | undefined | null>(null)
  const savedVersion = useRef<number | undefined>(undefined)
  const id = useId()

  // 另一個分頁或重新載入帶來新內容時，只在使用者沒有未保存的輸入時才同步進來
  useEffect(() => { if (!dirty.current) setText(value) }, [value])

  const save = async (next: string) => {
    setStatus('saving')
    try {
      const saved = await saveRef.current(next, base.current ?? undefined)
      if (typeof saved === 'number') {
        savedVersion.current = saved
        base.current = saved
      }
      if (latest.current === next) {
        dirty.current = false
        base.current = null
      }
      setStatus('saved')
      setMessage('')
    } catch (e) {
      // 下一次輸入時改以最新的版本為起點，使用者可以決定是否保留自己的文字再存一次
      base.current = null
      setStatus('error')
      setMessage(isAppError(e) ? ERROR_MESSAGES[e.code] : '沒有保存成功，文字還留在框裡，可以稍後再試。')
    }
  }

  useEffect(() => () => {
    clearTimeout(timer.current)
    // 離開時還有沒存的文字就立刻存一次
    if (dirty.current) void saveRef.current(latest.current, base.current ?? undefined).catch(() => {})
  }, [])

  const change = (next: string) => {
    if (base.current === null) base.current = Math.max(version ?? 0, savedVersion.current ?? 0) || version
    setText(next)
    latest.current = next
    dirty.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void save(next), 800)
  }

  return (
    <div className="note-editor">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        value={text}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={4}
        autoFocus={autoFocus}
        onChange={e => change(e.target.value)}
      />
      <div className="note-meta" aria-live="polite">
        <span data-status={status}>
          {status === 'saving' ? '保存中…' : status === 'saved' ? '已自動保存' : status === 'error' ? message : ''}
        </span>
        <span>{len(text)}／{maxLength}</span>
      </div>
    </div>
  )
}
