// 保存層對外的入口。功能模組只透過這裡讀寫使用者資料；卦殿首屏不得靜態匯入這個模組，
// 要在首屏顯示後才以 import() 載入（Dexie 一個就吃掉大半首屏預算）。

export * from './db.ts'
export { openStorage, type OpenOptions, type StorageHandle, type StorageMode } from './open.ts'
export { currentStorageMode, getStorage, provideStorage, requireDb, subscribeStorageMode } from './connection.ts'
export { clearErrors, logError, readErrors, storageStatus, type ErrorEntry, type StorageStatus } from './diagnostics.ts'
export * as settings from './repos/settings.ts'
export * as meta from './repos/meta.ts'
export * as draft from './repos/draft.ts'
export * as readings from './repos/readings.ts'
export * as daily from './repos/daily.ts'
export * as xp from './repos/xp.ts'
export * as attempts from './repos/attempts.ts'
export * as lessons from './repos/lessons.ts'
export * as exams from './repos/exams.ts'
export * as mastery from './repos/mastery.ts'
export * as review from './repos/review.ts'
export * as seals from './repos/seals.ts'
export { useDb, useLiveQuery, useStorageMode } from './react.ts'
// 非 React 的訂閱（例如卦殿學習地圖在動態載入後才訂閱）
export { liveQuery } from 'dexie'
export * as maintenance from './repos/maintenance.ts'
