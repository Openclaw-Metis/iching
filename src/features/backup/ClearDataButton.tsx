// 清除全部資料：要輸入「清除」兩字才能確認，完成後回到首次使用狀態。

import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from '../../app/toast.ts'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { logError, maintenance } from '../../storage/index.ts'

export function ClearDataButton() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  return (
    <section className="settings-section">
      <h3>清除全部資料</h3>
      <p className="note">刪掉這台裝置上的所有紀錄、收藏與學習進度，無法復原。需要的話先匯出備份。</p>
      <button type="button" className="btn btn-danger" onClick={() => setOpen(true)}>清除全部資料</button>
      <ConfirmDialog
        open={open}
        title="清除全部資料？"
        confirmLabel="清除"
        danger
        requireText="清除"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false)
          void maintenance.clearAll().then(
            () => { toast('已清除全部資料'); navigate('/') },
            e => { logError('CLEAR_FAILED', String((e as Error).message)); toast('清除沒有成功，資料沒有變動。') },
          )
        }}
      >
        <p>所有占卜紀錄、今日卦、收藏、學堂進度與設定都會刪除，無法復原。</p>
      </ConfirmDialog>
    </section>
  )
}
