// 筆記與事後回顧：停止輸入 800 ms 後自動保存。保存失敗或另一個分頁改過時，剛輸入的文字留在框裡，
// 由使用者自己決定要不要再存一次。

import { useEffect, useId, useRef, useState } from 'react'
import { ERROR_MESSAGES, isAppError } from '../lib/errors.ts'

interface Props {
  label: string
  value: string
  placeholder?: string
  maxLength?: number
  autoFocus?: boolean
  onSave: (text: string) => Promise<void>
}

type Status = 'idle' | 'saving' | 'saved' | 'error'

const len = (s: string) => [...s].length

export function NoteEditor({ label, value, placeholder, maxLength = 2000, autoFocus = false, onSave }: Props) {
  const [text, setText] = useState(value)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latest = useRef(text)
  const saveRef = useRef(onSave)
  saveRef.current = onSave
  const id = useId()

  // 另一個分頁或重新載入帶來新內容時，只在使用者沒有未保存的輸入時才同步進來
  useEffect(() => { if (!dirty.current) setText(value) }, [value])

  const save = async (next: string) => {
    setStatus('saving')
    try {
      await saveRef.current(next)
      if (latest.current === next) dirty.current = false
      setStatus('saved')
      setMessage('')
    } catch (e) {
      setStatus('error')
      setMessage(isAppError(e) ? ERROR_MESSAGES[e.code] : '沒有保存成功，文字還留在框裡，可以稍後再試。')
    }
  }

  useEffect(() => () => {
    clearTimeout(timer.current)
    // 離開時還有沒存的文字就立刻存一次
    if (dirty.current) void saveRef.current(latest.current).catch(() => {})
  }, [])

  const change = (next: string) => {
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
