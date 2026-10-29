// 換頁焦點（規格「2026-10-29 介面檢視後修訂」）：單頁應用換路徑時，網址與標題換了，焦點卻還留在頁首導覽，
// 或因為點的卦牌已卸載而掉到 body，螢幕閱讀器聽不到新頁開始。這裡在路徑改變後把焦點交給新頁的 h1，
// 並回傳要在朗讀區念出的文字；按返回回到前一頁時，焦點還給離開時點選的那個連結。

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router'
import { titleFor } from './routes.ts'

const WAIT_MS = 3000

/** 延遲載入的頁面要等 Suspense 換上內容才有 h1，所以等到元素出現（最多 3 秒） */
function whenPresent(find: () => HTMLElement | null, done: (el: HTMLElement) => void): () => void {
  const found = find()
  if (found) { done(found); return () => {} }
  const observer = new MutationObserver(() => {
    const el = find()
    if (!el) return
    stop()
    done(el)
  })
  const timer = window.setTimeout(() => stop(), WAIT_MS)
  function stop() { observer.disconnect(); window.clearTimeout(timer) }
  observer.observe(document.body, { childList: true, subtree: true })
  return stop
}

function focusQuietly(el: HTMLElement) {
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
  el.focus({ preventScroll: true })
}

export function useRouteFocus(): string {
  const location = useLocation()
  const navType = useNavigationType()
  const [announce, setAnnounce] = useState('')
  const previous = useRef(location)
  // 離開某一頁時在主要內容裡點的連結，以那一頁的 location.key 記住，返回時用
  const returnTo = useRef(new Map<string, string>())
  const lastClick = useRef<{ key: string; href: string } | null>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('main a[href]')
      if (link) lastClick.current = { key: previous.current.key, href: link.getAttribute('href')! }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  useEffect(() => {
    const before = previous.current
    previous.current = location
    if (before.pathname === location.pathname) return
    if (lastClick.current?.key === before.key) returnTo.current.set(before.key, lastClick.current.href)
    lastClick.current = null
    setAnnounce(`已開啟：${titleFor(location.pathname).split('｜')[0]}`)

    // 頁內的控制項（倒轉、翻面、序卦）還在畫面上時，焦點留給它
    const active = document.activeElement
    const stays = active && active !== document.body && active.isConnected && !active.closest('.site-header') && active.closest('main')
    const back = navType === 'POP' ? returnTo.current.get(location.key) : undefined
    if (stays && !back) return
    return whenPresent(
      () => (back && document.querySelector<HTMLElement>(`main a[href="${CSS.escape(back)}"]`)) || document.querySelector<HTMLElement>('main h1'),
      focusQuietly,
    )
  }, [location, navType])

  return announce
}
