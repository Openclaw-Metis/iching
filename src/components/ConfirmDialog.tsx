// 需要使用者明確決定的對話框（重複提問、放棄、刪除、清除全部資料）。用原生 <dialog> 的 showModal，
// 焦點鎖定與 Esc 關閉都由瀏覽器處理；requireText 時要輸入確認字樣才能按確定。

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** 刪除、清除這類不可逆的動作：確定按鈕用朱紅 */
  danger?: boolean
  requireText?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = '取消', danger = false, requireText, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [typed, setTyped] = useState('')
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      setTyped('')
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const ready = !requireText || typed.trim() === requireText
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby={titleId}
      onCancel={e => { e.preventDefault(); onCancel() }}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
      {requireText && (
        <label className="confirm-input">
          請輸入「{requireText}」確認
          <input value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" />
        </label>
      )}
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className={danger ? 'btn btn-primary' : 'btn btn-strong'} disabled={!ready} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </dialog>
  )
}
