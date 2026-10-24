// 紀錄詳情（/me?record=<id>）：可修正問題的錯字、加星號、補寫筆記與事後回顧、刪除（5 秒內可復原）。
// 六爻與方法不可改。所有修改都帶著畫面看到的 rev，另一個分頁改過時會收到 WRITE_CONFLICT 並載入最新內容。

import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from '../../app/toast.ts'
import { NoteEditor } from '../../components/NoteEditor.tsx'
import { daysBetween, formatDateTime, localDateKey } from '../../lib/dates.ts'
import { ERROR_MESSAGES, isAppError } from '../../lib/errors.ts'
import { track } from '../../lib/events.ts'
import { logError, readings, useDb, useLiveQuery } from '../../storage/index.ts'
import { CATEGORY_LABELS, METHOD_LABELS, ReadingView } from '../divination/index.ts'

const UNDO_MS = 5000
const len = (s: string) => [...s.trim()].length

export function RecordDetail({ id }: { id: string }) {
  const db = useDb()
  const navigate = useNavigate()
  const reading = useLiveQuery(() => (db ? db.readings.get(id) : undefined), [db, id], null)
  const [editing, setEditing] = useState(false)
  const [question, setQuestion] = useState('')
  const [message, setMessage] = useState('')

  if (reading === null) return <p className="note center">載入中…</p>
  if (!reading || reading.deletedAt) {
    return (
      <div className="empty-state">
        <p>找不到這筆紀錄，可能已經刪除。</p>
        <Link className="btn" to="/me">回到紀錄列表</Link>
      </div>
    )
  }

  /** 以畫面看到的版本保存；筆記的衝突提示由 NoteEditor 顯示 */
  const save = async (patch: readings.ReadingPatch, rev = reading.rev) => (await readings.update(reading.id, patch, rev)).rev

  /** 星號、修改問題這類單次操作：衝突時在上方提示 */
  const act = (patch: readings.ReadingPatch) => save(patch).then(
    () => setMessage(''),
    e => { setMessage(isAppError(e) ? ERROR_MESSAGES[e.code] : '沒有保存成功，請再試一次。'); throw e },
  )

  const saveFollowUp = async (text: string, rev?: number) => {
    const trimmed = text.trim()
    const followUp = trimmed ? { text, writtenAt: reading.followUp?.writtenAt ?? new Date().toISOString() } : null
    const next = await save({ followUp }, rev)
    if (followUp && !reading.followUp) {
      track('followup_saved', { readingId: reading.id, daysAfter: daysBetween(localDateKey(new Date(reading.createdAt)), localDateKey()) })
    }
    return next
  }

  const remove = async () => {
    try {
      const deleted = await readings.softDelete(reading.id, reading.rev)
      track('record_deleted', { readingId: reading.id })
      navigate('/me')
      toast('已刪除', {
        durationMs: UNDO_MS,
        action: {
          label: '復原',
          onClick: () => {
            void readings.restore(deleted.id, deleted.rev).then(() => track('record_restored', { readingId: deleted.id })).catch(e => {
              logError(isAppError(e) ? e.code : 'WRITE_CONFLICT', String((e as Error).message))
              toast('復原沒有成功，這筆紀錄已在另一個分頁被改過。')
            })
          },
        },
      })
      // 超過 10 秒沒有復原就永久刪除
      setTimeout(() => { void readings.purgeDeleted().catch(() => {}) }, readings.PURGE_AFTER_MS + 500)
    } catch (e) {
      setMessage(isAppError(e) ? ERROR_MESSAGES[e.code] : '刪除沒有成功，請再試一次。')
    }
  }

  const header = (
    <div className="record-head">
      <p className="note">{formatDateTime(reading.createdAt)}・{METHOD_LABELS[reading.method]}・{CATEGORY_LABELS[reading.category]}</p>
      {editing ? (
        <div className="question-edit">
          <input value={question} maxLength={200} onChange={e => setQuestion(e.target.value)} aria-label="問題" />
          <button type="button" className="btn btn-strong" disabled={len(question) < 2} onClick={() => void act({ question }).then(() => setEditing(false), () => {})}>儲存</button>
          <button type="button" className="btn" onClick={() => setEditing(false)}>取消</button>
        </div>
      ) : (
        <h2 className="record-title">
          「{reading.question}」
          <button type="button" className="link-button" onClick={() => { setQuestion(reading.question); setEditing(true) }}>修改問題</button>
        </h2>
      )}
      <button type="button" className="btn star-toggle" aria-pressed={reading.starred === 1} onClick={() => void act({ starred: reading.starred ? 0 : 1 }).catch(() => {})}>
        {reading.starred ? '★ 已加星號' : '☆ 加星號'}
      </button>
      {message && <p className="inline-warning" role="alert">{message}</p>}
    </div>
  )

  const footer = (
    <>
      <NoteEditor label="這次的筆記" value={reading.note} version={reading.rev} placeholder="寫下當下的想法" onSave={(text, rev) => save({ note: text }, rev)} />
      <NoteEditor label="事後回顧" value={reading.followUp?.text ?? ''} version={reading.rev} placeholder="過一陣子回頭看，當初的判斷如何？" onSave={saveFollowUp} />
      <div className="step-actions">
        <Link className="btn" to="/me">回到紀錄列表</Link>
        <button type="button" className="btn btn-danger" onClick={() => void remove()}>刪除這筆紀錄</button>
      </div>
    </>
  )

  return <ReadingView reading={reading} header={header} footer={footer} />
}
