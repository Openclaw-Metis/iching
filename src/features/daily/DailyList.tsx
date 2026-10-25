// 書卜頁「每日」子分頁：依日期倒序列出翻過的今日卦與心得，可刪除單日（當天刪除後可以重新翻開）。

import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from '../../app/toast.ts'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { HexagramGlyph } from '../../components/HexagramGlyph.tsx'
import { hexagram } from '../../data/hexagrams.ts'
import { localDateKey } from '../../lib/dates.ts'
import { daily, useDb, useLiveQuery, type DailyDraw } from '../../storage/index.ts'

const PAGE = 60

const slashDate = (date: string) => date.replace(/-/g, '/')

export function DailyList() {
  const db = useDb()
  const [limit, setLimit] = useState(PAGE)
  const [pending, setPending] = useState<string | null>(null)
  const rows = useLiveQuery<DailyDraw[] | undefined>(() => (db ? daily.listOf(db, limit) : undefined), [db, limit])

  const remove = async (date: string) => {
    setPending(null)
    try {
      await daily.remove(date)
      toast(date === localDateKey() ? '已刪除，今天可以重新翻開' : '已刪除')
    } catch {
      toast('刪除失敗，請再試一次。')
    }
  }

  if (!rows) return null
  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <p>還沒有翻過今日卦。</p>
        <Link className="btn btn-primary" to="/today">去翻今日卦</Link>
      </div>
    )
  }

  return (
    <>
      <ul className="records">
        {rows.map(r => {
          const hex = hexagram(r.hexagram)
          return (
            <li key={r.date} className="record-item daily-item">
              <span className="record-date">{slashDate(r.date)}</span>
              <button type="button" className="link-button" onClick={() => setPending(r.date)} aria-label={`刪除 ${slashDate(r.date)} 的今日卦`}>刪除</button>
              <Link className="record-hex" to={`/gua/${hex.number}`}>
                <HexagramGlyph lines={hex.lines} />
                {hex.name}・{hex.fullName}
              </Link>
              {r.note && <span className="record-question">{r.note}</span>}
            </li>
          )
        })}
        {rows.length === limit && (
          <li className="record-more">
            <button type="button" className="btn" onClick={() => setLimit(l => l + PAGE)}>載入更多</button>
          </li>
        )}
      </ul>
      <ConfirmDialog
        open={pending !== null}
        title={`刪除 ${pending ? slashDate(pending) : ''} 的今日卦？`}
        confirmLabel="刪除"
        danger
        onConfirm={() => pending && void remove(pending)}
        onCancel={() => setPending(null)}
      >
        <p>這一天的卦與心得會一起刪除。刪除的若是今天，可以重新翻開一張；翻開的 XP 每天只記一次。</p>
      </ConfirmDialog>
    </>
  )
}
