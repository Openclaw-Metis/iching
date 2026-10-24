// 保存狀態膠囊：成功用灰青，不用綠色；失敗另有警示列處理，這裡只是一行狀態。

export type SaveStatus = 'saving' | 'saved' | 'draft-unsaved' | 'failed' | 'memory'

const TEXT: Record<SaveStatus, string> = {
  saving: '保存中…',
  saved: '已存入紀錄',
  'draft-unsaved': '進度暫時無法保存',
  failed: '沒有存進紀錄',
  memory: '已暫存，關閉分頁後會消失',
}

export function SaveStatusPill({ status }: { status: SaveStatus }) {
  return <span className="save-pill" data-status={status} role="status">{TEXT[status]}</span>
}
