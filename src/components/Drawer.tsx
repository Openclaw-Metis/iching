// 低頻但內容較多的抽屜（規格「容器策略」）：電腦版從右側滑出，手機版為底部抽屜。
// 用原生 <dialog> 的 showModal，焦點鎖定與 Esc 關閉由瀏覽器處理；點背景也會關閉。

import { useEffect, useId, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  title: ReactNode
  iconOnlyClose?: boolean
  onClose: () => void
  children: ReactNode
}

export function Drawer({ open, title, iconOnlyClose = false, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className="drawer"
      aria-labelledby={titleId}
      onCancel={e => { e.preventDefault(); onClose() }}
      // 點在 dialog 本身（背景）而不是內容時關閉
      onClick={e => { if (e.target === ref.current) onClose() }}
    >
      <div className="drawer-body">
        <header className="drawer-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className={iconOnlyClose ? 'icon-button' : 'btn'} aria-label="關閉" onClick={onClose}>
            {iconOnlyClose ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg> : '關閉'}
          </button>
        </header>
        {children}
      </div>
    </dialog>
  )
}
