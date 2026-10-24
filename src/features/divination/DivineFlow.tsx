// 占卜流程（規格「核心流程設計：流程 A」與「狀態矩陣（占卜頁）」）：問題 › 起卦 › 解讀三步驟，同一時間只顯示目前步驟。
// 每成一爻就寫入起卦草稿，中途離開或重新整理可以接續；六爻完成時在同一個交易建立紀錄並刪除草稿，
// 失敗時進入 blocked，解讀照常顯示，主操作改為下載這次結果。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../app/toast.ts'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { LineBuilder } from '../../components/LineBuilder.tsx'
import { Stepper } from '../../components/Stepper.tsx'
import type { LineValue } from '../../lib/castLines.ts'
import { isAppError } from '../../lib/errors.ts'
import { track } from '../../lib/events.ts'
import {
  draft as draftRepo, logError, readings as readingsRepo, useDb, useLiveQuery, useStorageMode,
  type CastDraft, type Reading,
} from '../../storage/index.ts'
import { downloadFile, partialBackup, readingFileName } from '../backup/index.ts'
import { CastStep } from './CastStep.tsx'
import { createDraftQueue, type DraftSaveState } from './draftQueue.ts'
import { CATEGORY_LABELS, DRAFT_METHOD_LABELS, METHOD_LABELS } from './labels.ts'
import { QUESTION_MIN, QuestionStep } from './QuestionStep.tsx'
import { ResultStep } from './ResultStep.tsx'
import { YarrowAnimation } from './YarrowAnimation.tsx'
import { yarrowLine, type YarrowLine } from './yarrow.ts'

type View =
  | { kind: 'loading' }
  | { kind: 'resume'; saved: CastDraft }
  | { kind: 'question' }
  | { kind: 'casting' }
  | { kind: 'result'; reading: Reading }
  | { kind: 'blocked'; reading: Reading; error: unknown }

const DAY_MS = 24 * 60 * 60 * 1000
// 這個分頁最近一次的結果：一鍵完成的動畫中離開、或看完卡牌頁回來時，直接顯示結果而不是空白的問題框
const LAST_RESULT_KEY = 'iching:divine-result'
const STEPS = ['問題', '起卦', '解讀']

const len = (s: string) => [...s.trim()].length
const errorCode = (e: unknown) => (isAppError(e) ? e.code : (e as Error)?.name ?? 'unknown')

function newDraft(): CastDraft {
  const now = new Date().toISOString()
  return {
    key: 'current', castId: crypto.randomUUID(), phase: 'question', rev: 0, question: '', category: 'general',
    method: 'coins', yarrowMode: 'quick', lines: [], yarrow: null, startedAt: now, updatedAt: now,
  }
}

const session = {
  get: () => { try { return sessionStorage.getItem(LAST_RESULT_KEY) } catch { return null } },
  set: (id: string | null) => {
    try { if (id) sessionStorage.setItem(LAST_RESULT_KEY, id); else sessionStorage.removeItem(LAST_RESULT_KEY) } catch { /* 隱私模式等情況，少了這個便利而已 */ }
  },
}

export function DivineFlow() {
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [draft, setDraftState] = useState<CastDraft>(newDraft)
  const draftRef = useRef(draft)
  const setDraft = (next: CastDraft) => { draftRef.current = next; setDraftState(next) }
  const [saveState, setSaveState] = useState<DraftSaveState>('idle')
  const [animation, setAnimation] = useState<YarrowLine[] | null>(null)
  const [confirm, setConfirm] = useState<null | 'duplicate' | 'abandon'>(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const storageMode = useStorageMode()
  const conflictRef = useRef<() => void>(() => {})

  const queue = useMemo(() => createDraftQueue({
    save: s => draftRepo.save(s),
    onState: (state, error) => {
      setSaveState(state)
      if (state === 'failed') {
        track('divine_draft_save_failed', { errorCode: errorCode(error), linesDone: draftRef.current.lines.length })
        logError('DRAFT_SAVE_FAILED', String((error as Error)?.message ?? error))
      }
    },
    onConflict: () => conflictRef.current(),
  }), [])

  const showResult = (reading: Reading) => {
    session.set(reading.id)
    setView({ kind: 'result', reading })
  }

  /** 六爻完成：建立紀錄並刪除草稿；失敗時進入 blocked */
  const complete = async (done: CastDraft) => {
    const built = readingsRepo.readingFromDraft(done)
    track('divine_resolved', { primary: built.primary, result: built.result, movingCount: built.moving.length })
    try {
      const reading = await readingsRepo.completeCast(done)
      await queue.reset(null)
      track('divine_saved', { readingId: reading.id })
      showResult(reading)
    } catch (e) {
      track('divine_save_failed', { errorCode: errorCode(e) })
      logError(isAppError(e) ? e.code : 'STORAGE_QUOTA', String((e as Error)?.message ?? e))
      setView({ kind: 'blocked', reading: built, error: e })
    }
  }

  /** 草稿已是 complete：有同 castId 的紀錄就直接顯示，否則重試建立 */
  const settleComplete = async (saved: CastDraft) => {
    const existing = await readingsRepo.get(saved.castId).catch(() => undefined)
    if (existing) {
      await draftRepo.clear(saved.castId).catch(() => {})
      showResult(existing)
      return
    }
    setDraft(saved)
    await complete(saved)
  }

  // 進入頁面：依草稿的 phase 接續、顯示既有紀錄或重試保存
  useEffect(() => {
    let alive = true
    void (async () => {
      const saved = await draftRepo.get().catch(() => undefined)
      if (!alive) return
      if (saved?.phase === 'complete') return settleComplete(saved)
      if (saved) return setView({ kind: 'resume', saved })
      const lastId = session.get()
      const last = lastId ? await readingsRepo.get(lastId).catch(() => undefined) : undefined
      if (!alive) return
      if (last && !last.deletedAt) return showResult(last)
      await queue.reset(draftRef.current)
      setView({ kind: 'question' })
    })()
    return () => { alive = false }
  }, []) // 只在進入頁面時執行一次

  // 頁面切到背景或離開時，把還沒寫入的草稿寫進去
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void queue.flush() }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      void queue.flush()
    }
  }, [queue])

  // 另一個分頁改了草稿：以資料庫的版本為準
  conflictRef.current = () => {
    void (async () => {
      const mine = draftRef.current
      const stored = await draftRepo.get().catch(() => undefined)
      if (stored && stored.castId === mine.castId) {
        await queue.reset(stored)
        setDraft(stored)
        toast('另一個分頁正在起卦，已同步到最新進度。')
        if (stored.phase === 'complete') return settleComplete(stored)
        return setView({ kind: stored.phase === 'casting' ? 'casting' : 'question' })
      }
      const finished = await readingsRepo.get(mine.castId).catch(() => undefined)
      if (finished) {
        await queue.reset(null)
        toast('這次起卦已在另一個分頁完成。')
        return showResult(finished)
      }
      if (stored) {
        await queue.reset(null)
        return setView({ kind: 'resume', saved: stored })
      }
      // 草稿在另一個分頁被放棄了：以目前的內容重新開始一份
      const fresh = { ...mine, castId: crypto.randomUUID(), rev: 0 }
      await queue.reset(fresh)
      setDraft(fresh)
      void queue.update(fresh)
    })()
  }

  const startFresh = async () => {
    const old = draftRef.current
    const fresh = newDraft()
    await queue.reset(fresh)
    await draftRepo.clear(old.castId).catch(() => {})
    session.set(null)
    setAnimation(null)
    setSummaryOpen(false)
    setDraft(fresh)
    setView({ kind: 'question' })
  }

  const changeQuestion = (patch: Partial<CastDraft>) => {
    const next = { ...draftRef.current, ...patch }
    if (next.phase === 'question' && !next.question.trim()) {
      // 清空問題就不留草稿；之後再輸入時以新的 castId 重新開始
      const old = draftRef.current
      const fresh = { ...next, castId: crypto.randomUUID(), rev: 0 }
      setDraft(fresh)
      void queue.reset(fresh).then(() => draftRepo.clear(old.castId)).catch(() => {})
      return
    }
    setDraft(next)
    void queue.update(next, { debounceMs: 500 })
  }

  const start = async (skipDuplicateCheck = false) => {
    const current = draftRef.current
    const question = current.question.trim()
    if (len(question) < QUESTION_MIN) return
    if (!skipDuplicateCheck) {
      const duplicate = await readingsRepo.hasExactQuestionSince(question, new Date(Date.now() - DAY_MS)).catch(() => false)
      if (duplicate) {
        setConfirm('duplicate')
        return
      }
    }
    track('divine_start', { method: current.method, category: current.category, questionLength: len(question) })
    const base: CastDraft = { ...current, question, startedAt: new Date().toISOString() }

    if (base.method === 'yarrow' && base.yarrowMode === 'quick') {
      // 一鍵完成：六爻先算好並保存，再播放過程動畫
      const lines = Array.from({ length: 6 }, () => yarrowLine())
      const done: CastDraft = { ...base, phase: 'complete', lines: lines.map(l => l.value) }
      lines.forEach((l, index) => track('divine_line_cast', { index, value: l.value, method: 'yarrow-quick' }))
      setDraft(done)
      setAnimation(lines)
      setView({ kind: 'casting' })
      await queue.update(done)
      await complete(done)
      return
    }
    const next: CastDraft = { ...base, phase: 'casting', lines: [] }
    setDraft(next)
    setView({ kind: 'casting' })
    void queue.update(next)
  }

  const addLine = (value: LineValue) => {
    const current = draftRef.current
    if (current.lines.length >= 6) return
    const lines = [...current.lines, value]
    track('divine_line_cast', { index: lines.length - 1, value, method: current.method })
    if (lines.length < 6) {
      const next = { ...current, lines }
      setDraft(next)
      void queue.update(next)
      return
    }
    const done: CastDraft = { ...current, lines, phase: 'complete' }
    setDraft(done)
    void (async () => {
      await queue.update(done)
      await complete(done)
    })()
  }

  const resume = async (saved: CastDraft) => {
    await queue.reset(saved)
    setDraft(saved)
    track('divine_draft_resumed', { linesDone: saved.lines.length })
    setView({ kind: saved.phase === 'casting' ? 'casting' : 'question' })
  }

  // 解讀頁訂閱這筆紀錄：另一個分頁修改後畫面跟著更新
  const db = useDb()
  const shownId = view.kind === 'result' ? view.reading.id : null
  const live = useLiveQuery(() => (db && shownId ? db.readings.get(shownId) : undefined), [db, shownId])
  useEffect(() => {
    if (live && view.kind === 'result' && live.id === view.reading.id && live.rev > view.reading.rev) setView({ kind: 'result', reading: live })
  }, [live, view])

  const saveNote = async (text: string) => {
    if (view.kind !== 'result') return
    const { reading } = view
    try {
      showResult(await readingsRepo.update(reading.id, { note: text }, reading.rev))
    } catch (e) {
      if (isAppError(e, 'WRITE_CONFLICT')) {
        const latest = await readingsRepo.get(reading.id)
        if (latest) showResult(latest)
      }
      throw e
    }
  }

  const download = () => {
    if (view.kind !== 'blocked') return
    downloadFile(JSON.stringify(partialBackup(view.reading), null, 2), readingFileName(new Date()))
    toast('已下載這次結果，之後可以在「我的 › 設定與備份」匯入。')
  }

  const onAnimationDone = useCallback(() => setAnimation(null), [])

  const step = view.kind === 'casting' || animation ? 1 : view.kind === 'result' || view.kind === 'blocked' ? 2 : 0
  const summaryReading = view.kind === 'result' || view.kind === 'blocked' ? view.reading : null
  const methodLabel = summaryReading ? METHOD_LABELS[summaryReading.method] : DRAFT_METHOD_LABELS[draft.method]
  const question = summaryReading?.question ?? draft.question.trim()
  const category = summaryReading?.category ?? draft.category

  return (
    <div className="divine">
      <header className="page-head">
        <h1>占卜</h1>
        <Stepper steps={STEPS} current={step} label="占卜步驟" onSelect={() => setSummaryOpen(o => !o)} />
        {step > 0 && (
          <p className="question-summary">
            你問的事：「{question}」　<span>類別：{CATEGORY_LABELS[category]}　方法：{methodLabel}</span>
          </p>
        )}
        {step > 0 && summaryOpen && (
          <div className="step-summary">
            <LineBuilder lines={summaryReading?.lines ?? draft.lines} />
            <p className="note">已成的爻不能修改。想問別的事，請按「{step === 2 ? '再問一事' : '放棄這次起卦'}」。</p>
          </div>
        )}
      </header>

      {view.kind === 'loading' && <p className="note center">載入中…</p>}

      {view.kind === 'resume' && (
        <section className="divine-step resume-step">
          <p className="resume-title">
            {view.saved.phase === 'casting' ? `接續上次的起卦（已完成 ${view.saved.lines.length} 爻）` : '接續上次寫到一半的問題'}
          </p>
          {view.saved.question.trim() && <p className="note">「{view.saved.question.trim()}」</p>}
          <div className="step-actions">
            <button type="button" className="btn btn-primary" onClick={() => void resume(view.saved)}>接續</button>
            <button type="button" className="btn" onClick={() => {
              setDraft(view.saved)
              if (view.saved.lines.length) setConfirm('abandon')
              else void startFresh()
            }}>放棄</button>
          </div>
        </section>
      )}

      {view.kind === 'question' && (
        <QuestionStep draft={draft} saveState={saveState} onChange={changeQuestion} onStart={() => void start()} />
      )}

      {animation && <YarrowAnimation lines={animation} onDone={onAnimationDone} />}

      {!animation && view.kind === 'casting' && (
        <CastStep
          draft={draft}
          saveState={saveState}
          onLine={addLine}
          onAbandon={() => { if (draftRef.current.lines.length) setConfirm('abandon'); else void startFresh() }}
        />
      )}

      {!animation && (view.kind === 'result' || view.kind === 'blocked') && (
        <ResultStep
          reading={view.reading}
          status={view.kind === 'blocked' ? 'failed' : storageMode === 'memory' ? 'memory' : 'saved'}
          error={view.kind === 'blocked' ? view.error : undefined}
          onSaveNote={saveNote}
          onAgain={() => void startFresh()}
          onDownload={download}
          onRetry={() => void complete(draftRef.current)}
        />
      )}

      <ConfirmDialog
        open={confirm === 'duplicate'}
        title="再問一次？"
        confirmLabel="仍要起卦"
        cancelLabel="換個問題"
        onConfirm={() => {
          setConfirm(null)
          track('duplicate_question_warned', { continued: true })
          void start(true)
        }}
        onCancel={() => {
          setConfirm(null)
          track('duplicate_question_warned', { continued: false })
        }}
      >
        <p>你在 24 小時內問過同一件事。《周易》蒙卦說：『初筮告，再三瀆，瀆則不告。』仍要再問一次嗎？</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'abandon'}
        title="放棄這次起卦？"
        confirmLabel="放棄"
        cancelLabel="繼續起卦"
        danger
        onConfirm={() => { setConfirm(null); void startFresh() }}
        onCancel={() => setConfirm(null)}
      >
        <p>已擲出的 {draft.lines.length} 爻不會保存。</p>
      </ConfirmDialog>
    </div>
  )
}
