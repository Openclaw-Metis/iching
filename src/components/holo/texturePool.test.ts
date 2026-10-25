import { describe, expect, it, vi } from 'vitest'
import { createTexturePool } from './texturePool.ts'

describe('全息卡貼圖生命週期', () => {
  it('同一張貼圖共用，直到最後一個使用者釋放才 dispose；重複釋放不影響新請求', async () => {
    const texture = { dispose: vi.fn() }
    const load = vi.fn(async () => texture)
    const pool = createTexturePool(load)
    const front = pool.acquire('card'), back = pool.acquire('card')
    expect(await front.ready).toBe(await back.ready)
    expect(load).toHaveBeenCalledTimes(1)
    front.release()
    await Promise.resolve()
    expect(texture.dispose).not.toHaveBeenCalled()
    back.release()
    await Promise.resolve()
    expect(texture.dispose).toHaveBeenCalledTimes(1)
    const next = pool.acquire('card')
    front.release()
    await next.ready
    expect(load).toHaveBeenCalledTimes(2)
    next.release()
  })

  it('載入途中取消，稍後完成仍會釋放', async () => {
    const texture = { dispose: vi.fn() }
    let resolve!: (value: typeof texture) => void
    const pool = createTexturePool(() => new Promise<typeof texture>(done => { resolve = done }))
    const pending = pool.acquire('card')
    await Promise.resolve()
    pending.release()
    expect(texture.dispose).not.toHaveBeenCalled()
    resolve(texture)
    await pending.ready
    expect(texture.dispose).toHaveBeenCalledTimes(1)
  })

  it('失敗請求可以重試，舊請求釋放不會移除新的貼圖', async () => {
    const texture = { dispose: vi.fn() }
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(texture)
    const pool = createTexturePool<typeof texture>(load)
    const failed = pool.acquire('card')
    await expect(failed.ready).rejects.toThrow('offline')
    const retry = pool.acquire('card')
    failed.release()
    const shared = pool.acquire('card')
    expect(await retry.ready).toBe(await shared.ready)
    expect(load).toHaveBeenCalledTimes(2)
    retry.release()
    shared.release()
    await Promise.resolve()
    expect(texture.dispose).toHaveBeenCalledTimes(1)
  })

  it('連續換 64 張卡時，已換下的每一張都會釋放', async () => {
    const textures = Array.from({ length: 64 }, () => ({ dispose: vi.fn() }))
    const pool = createTexturePool(async url => textures[Number(url)])
    let active = pool.acquire('0')
    await active.ready
    for (let n = 1; n < textures.length; n++) {
      const next = pool.acquire(String(n))
      await next.ready
      active.release()
      active = next
    }
    active.release()
    await Promise.resolve()
    for (const t of textures) expect(t.dispose).toHaveBeenCalledTimes(1)
  })
})
