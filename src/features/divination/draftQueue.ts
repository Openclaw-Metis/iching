// 起卦草稿的寫入佇列。寫入依序執行，每次寫入的都是當下最新的完整草稿（不是只寫變動的欄位），
// 所以前一次失敗的內容會被下一次寫入一併補上，較舊的寫入也不會蓋過較新的進度。
// 寫入失敗時進度留在記憶體，下一次變動、flush 或 retry 時自動重試；另一個分頁改過草稿時交給呼叫端重新載入。

import { isAppError } from '../../lib/errors.ts'
import type { CastDraft } from '../../storage/index.ts'

export type DraftSaveState = 'idle' | 'saving' | 'saved' | 'failed'

export interface DraftQueueOptions {
  /** 寫入完整草稿，回傳寫入後的 rev；rev 不符時拋出 WRITE_CONFLICT */
  save(snapshot: CastDraft): Promise<number>
  onState?(state: DraftSaveState, error?: unknown): void
  onConflict?(): void
}

export interface DraftQueue {
  /** 目前記憶體裡最新的草稿 */
  current(): CastDraft | null
  /** 換成另一份草稿（接續、放棄、再問一事）；會等進行中的寫入結束，之後不再寫入舊草稿 */
  reset(next: CastDraft | null): Promise<void>
  /** 草稿有變動；debounceMs 大於 0 時延後寫入（輸入問題時），否則立即寫入 */
  update(next: CastDraft, options?: { debounceMs?: number }): Promise<boolean>
  /** 立即寫入尚未保存的變動，回傳是否成功 */
  flush(): Promise<boolean>
  state(): DraftSaveState
}

export function createDraftQueue(options: DraftQueueOptions): DraftQueue {
  let latest: CastDraft | null = null
  let dirty = false
  let generation = 0
  let running: Promise<boolean> | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let state: DraftSaveState = 'idle'
  // 延後寫入的呼叫者，等到真正寫入（或被 reset 取消）時一起通知
  let waiters: ((ok: boolean) => void)[] = []
  const settle = (ok: boolean) => {
    const w = waiters
    waiters = []
    for (const resolve of w) resolve(ok)
  }

  const setState = (next: DraftSaveState, error?: unknown) => {
    state = next
    options.onState?.(next, error)
  }

  async function run(): Promise<boolean> {
    while (dirty && latest) {
      dirty = false
      const snapshot = latest
      const mine = generation
      setState('saving')
      try {
        const rev = await options.save(snapshot)
        if (mine !== generation) return true
        // 寫入期間若又有變動，latest 已是新物件：只換上新的 rev，內容保留最新的
        latest = { ...latest!, rev }
      } catch (e) {
        if (mine !== generation) return true
        if (isAppError(e, 'WRITE_CONFLICT')) {
          setState('idle')
          options.onConflict?.()
          return false
        }
        dirty = true
        setState('failed', e)
        return false
      }
    }
    setState('saved')
    return true
  }

  function flush(): Promise<boolean> {
    clearTimeout(timer)
    timer = undefined
    let done: Promise<boolean>
    if (running) {
      // 進行中的寫入結束後，迴圈會接著寫最新的草稿；失敗的那一輪則在這裡重新開始
      done = running.then(ok => (dirty ? flush() : ok))
    } else if (!dirty) {
      done = Promise.resolve(state !== 'failed')
    } else {
      running = run().finally(() => { running = null })
      done = running
    }
    void done.then(settle)
    return done
  }

  return {
    current: () => latest,
    state: () => state,
    async reset(next) {
      clearTimeout(timer)
      timer = undefined
      generation++
      dirty = false
      latest = next
      settle(true)
      await running?.catch(() => {})
      setState('idle')
    },
    update(next, { debounceMs = 0 } = {}) {
      const rev = latest && latest.castId === next.castId ? latest.rev : next.rev
      latest = { ...next, rev }
      dirty = true
      if (debounceMs > 0) {
        clearTimeout(timer)
        timer = setTimeout(() => { void flush() }, debounceMs)
        return new Promise(resolve => { waiters.push(resolve) })
      }
      return flush()
    },
    flush,
  }
}
