/** 首屏畫完、瀏覽器有空時才執行；沒有 requestIdleCallback 的瀏覽器（Safari）稍等一下。回傳取消函式 */
export function afterFirstPaint(run: () => void): () => void {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(run, { timeout: 2000 })
    return () => window.cancelIdleCallback(id)
  }
  const id = setTimeout(run, 300)
  return () => clearTimeout(id)
}
