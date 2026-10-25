export interface TextureLease<T> {
  ready: Promise<T>
  release(): void
}

/** 只共用仍被正背面或換牌請求使用的貼圖，不保留閒置的解碼圖片與 GPU 資源。 */
export function createTexturePool<T extends { dispose(): void }>(load: (url: string) => Promise<T>) {
  const entries = new Map<string, { refs: number; ready: Promise<T> }>()
  return {
    acquire(url: string): TextureLease<T> {
      let entry = entries.get(url)
      if (!entry) {
        const fresh = { refs: 0, ready: Promise.resolve().then(() => load(url)) }
        fresh.ready = fresh.ready.catch(error => {
          if (entries.get(url) === fresh) entries.delete(url)
          throw error
        })
        entries.set(url, fresh)
        entry = fresh
      }
      const held = entry
      held.refs++
      let released = false
      return {
        ready: held.ready,
        release() {
          if (released) return
          released = true
          if (--held.refs !== 0) return
          if (entries.get(url) === held) entries.delete(url)
          // 載入途中取消也要等它完成後釋放，不能只清掉 Map。
          void held.ready.then(t => t.dispose(), () => {})
        },
      }
    },
  }
}
