// 註冊 service worker 並在有新版本時提示（規格「通知與背景執行」的新版本檢查）。
// 載入時與之後每 60 分鐘檢查一次；按「重新整理」才換上新版本，避免正在占卜或作答時被打斷。
// 這個元件在首屏顯示後才以 import() 載入，workbox-window 不進卦殿首屏。

import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_MS = 60 * 60 * 1000

export default function UpdateToast() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => { void registration.update().catch(() => {}) }, CHECK_MS)
    },
    // 檢查失敗靜默略過
    onRegisterError() {},
  })
  if (!needRefresh) return null
  return (
    <div className="update-toast" role="status">
      <span>網站有新版本</span>
      <button type="button" className="btn btn-primary" onClick={() => void updateServiceWorker(true)}>重新整理</button>
      <button type="button" className="btn" onClick={() => setNeedRefresh(false)}>稍後</button>
    </div>
  )
}
