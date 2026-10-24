// 新取得的印章以 toast 告知。學堂以外的事件（大衍筮法占卜、寫回顧、翻今日卦帶來的打卡）
// 以 import() 載入這個模組再判定，占卜頁與今日頁的程式包才不會帶上學堂與 ts-fsrs。

import { toast } from '../../app/toast.ts'
import { logError, type SealId } from '../../storage/index.ts'
import { checkSeals, sealInfo } from './seals.ts'

export function announceSeals(ids: SealId[]) {
  for (const id of ids) toast(`取得「${sealInfo(id).char}」印：${sealInfo(id).condition}`)
}

export async function checkAndAnnounce(): Promise<void> {
  try {
    announceSeals(await checkSeals())
  } catch (e) {
    logError('SEAL_CHECK_FAILED', String((e as Error)?.message ?? e))
  }
}
