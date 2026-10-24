import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { provideStorage } from '../connection.ts'
import { openStorage } from '../open.ts'
import * as meta from './meta.ts'
import * as settings from './settings.ts'

beforeEach(async () => provideStorage(await openStorage({ indexedDB: new IDBFactory(), IDBKeyRange })))

describe('設定與中繼資料', () => {
  it('沒有寫過的設定回傳預設值', async () => {
    expect(await settings.get('dailyGoal')).toBe(30)
    expect(await settings.get('lastBackupAt')).toBeUndefined()
  })

  it('寫入後讀回，並帶 updatedAt', async () => {
    await settings.set('dailyGoal', 50, new Date('2026-10-24T00:00:00Z'))
    expect(await settings.get('dailyGoal')).toBe(50)
  })

  it('ensureDefaults 不覆寫已存在的值', async () => {
    await settings.set('reminderTime', '21:00')
    await settings.ensureDefaults()
    expect(await settings.get('reminderTime')).toBe('21:00')
    expect(await settings.get('dailyGoal')).toBe(30)
  })

  it('meta 記錄資料表版本', async () => {
    expect((await meta.get())?.schema).toBe(1)
  })
})
