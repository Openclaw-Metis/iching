// 錯誤碼與使用者看到的訊息，對應規格「錯誤處理」表。程式內部一律拋 AppError，畫面依 code 顯示訊息。

export const ERROR_MESSAGES = {
  STORAGE_UNAVAILABLE: '這個瀏覽器目前無法保存資料，關閉分頁後紀錄會消失。建議改用一般視窗開啟。',
  STORAGE_VERSION: '網站已更新，請重新整理頁面。',
  STORAGE_UPGRADE_FAILED: '資料更新沒有完成，你的資料沒有變動。請重新整理再試一次。',
  STORAGE_BLOCKED: '請先關閉其他開著易經卦殿的分頁。',
  STORAGE_STALE_TAB: '網站已在另一個分頁更新，請重新整理。',
  STORAGE_QUOTA: '裝置空間不足，這次結果沒有存進紀錄。可以先下載保存。',
  DRAFT_SAVE_FAILED: '進度暫時無法保存，關閉頁面會遺失。',
  WRITE_CONFLICT: '這筆紀錄在另一個分頁被改過，已載入最新內容。',
  EXAM_EXPIRED: '這場考核已跨日，請重新開始考核。',
  IMPORT_INVALID_FILE: '這個檔案不是易經卦殿的備份檔。',
  IMPORT_TOO_LARGE: '檔案太大（每個檔案上限 50 MB）。',
  IMPORT_INCOMPLETE_SET: '還缺檔案，請把同一次匯出的所有檔案一起選取。',
  IMPORT_NEWER_FORMAT: '這個備份來自較新版的網站，請先重新整理再匯入。',
  IMPORT_PARTIAL: '有部分資料格式不正確，將會略過。',
  CONTENT_LOAD_FAILED: '內容載入失敗，請確認網路後重試。',
  WEBGL_UNAVAILABLE: '這個瀏覽器無法顯示全息效果，改用平面卡圖。',
} as const

export type ErrorCode = keyof typeof ERROR_MESSAGES

export class AppError extends Error {
  readonly code: ErrorCode
  constructor(code: ErrorCode, message: string = ERROR_MESSAGES[code], options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'AppError'
    this.code = code
  }
}

export const isAppError = (e: unknown, code?: ErrorCode): e is AppError =>
  e instanceof AppError && (code === undefined || e.code === code)

/** 寫入時空間不足：瀏覽器拋 QuotaExceededError，Dexie 可能包一層放在 inner */
export function isQuotaError(e: unknown): boolean {
  const names = [(e as { name?: string })?.name, (e as { inner?: { name?: string } })?.inner?.name]
  return names.includes('QuotaExceededError')
}
