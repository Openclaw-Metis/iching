// 重設學堂進度：要輸入「重設」兩字才能確認。占卜紀錄、今日卦、收藏與「筮」「錄」兩枚印章保留。

import { useState } from 'react'
import { toast } from '../../app/toast.ts'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { logError, maintenance } from '../../storage/index.ts'

export function ResetAcademyButton() {
  const [open, setOpen] = useState(false)
  return (
    <section className="settings-section">
      <h3>重設學堂進度</h3>
      <p className="note">清除課程與考核進度、溫故卡、XP、打卡與學堂印章，修行路線回到第一站。占卜紀錄與「筮」「錄」兩枚印章不受影響。</p>
      <button type="button" className="btn btn-danger" onClick={() => setOpen(true)}>重設學堂進度</button>
      <ConfirmDialog
        open={open}
        title="重設學堂進度？"
        confirmLabel="重設"
        danger
        requireText="重設"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false)
          void maintenance.resetAcademy().then(
            () => toast('學堂進度已重設'),
            e => { logError('RESET_ACADEMY_FAILED', String((e as Error).message)); toast('重設沒有成功，資料沒有變動。') },
          )
        }}
      >
        <p>課程、考核、溫故、XP、打卡與學堂印章都會刪除，無法復原。需要的話先匯出備份。</p>
      </ConfirmDialog>
    </section>
  )
}
