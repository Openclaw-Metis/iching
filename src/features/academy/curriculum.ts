// 修行路線（規格「學堂內容設計」）：8 站、每站 3 課與 1 場考核。站名與課名在 data/stations.ts，
// 這裡補上每課的閱讀段落與題型（lessons/*.json），以及各站考核的題型配比。

import { LESSON_IDS, parseLessonId, type Station } from '../../data/stations.ts'
import type { TrigramId } from '../../data/trigrams.ts'
import type { QuestionParams, QuestionType } from './questions/types.ts'

export interface ReadStep {
  kind: 'read'
  /** 100 字內 */
  text: string
  /** 附上的卦畫：六十四卦的卦序或八卦 */
  hexagram?: number
  trigram?: TrigramId
}

export interface QuizStep {
  kind: 'quiz'
  type: QuestionType
  count: number
  params?: QuestionParams
}

export type LessonStep = ReadStep | QuizStep

export interface Lesson {
  id: string
  station: Station
  title: string
  minutes: number
  steps: LessonStep[]
}

const files = import.meta.glob<{ default: Omit<Lesson, 'station' | 'title'> }>('./lessons/*.json', { eager: true })

export const LESSONS: Lesson[] = LESSON_IDS.map(id => {
  const raw = files[`./lessons/${id}.json`]?.default
  if (!raw) throw new Error(`缺少課程內容：${id}`)
  const { station, title } = parseLessonId(id)!
  return { ...raw, id, station, title }
})

const byId = new Map(LESSONS.map(l => [l.id, l]))
export const lessonById = (id: string) => byId.get(id)

export const EXAM_SIZE = 10
export const PASS_SCORE = 8

/** 各站考核的題型與題數，合計 10 題 */
export const EXAM_PLAN: Record<number, { type: QuestionType; count: number; params?: QuestionParams }[]> = {
  1: [{ type: 'line-position', count: 5 }, { type: 'line-label', count: 5 }],
  2: [{ type: 'trigram', count: 10 }],
  3: [{ type: 'pair-to-name', count: 4 }, { type: 'glyph-to-name', count: 3 }, { type: 'image-to-name', count: 3 }],
  4: [{ type: 'sequence', count: 10 }],
  5: [{ type: 'relation', count: 10 }],
  6: [{ type: 'daxiang-to-name', count: 5 }, { type: 'text-kind', count: 5 }],
  7: [{ type: 'position', count: 10 }],
  8: [{ type: 'method-probability', count: 4 }, { type: 'reading-rule', count: 6 }],
}

/** 課程的閱讀與作答展開成一步一步：閱讀一段算一步，每一題算一步 */
export type FlatStep = { kind: 'read'; step: ReadStep } | { kind: 'question'; index: number }

export function flatten(lesson: Lesson): FlatStep[] {
  let q = 0
  return lesson.steps.flatMap((s): FlatStep[] =>
    s.kind === 'read' ? [{ kind: 'read', step: s }] : Array.from({ length: s.count }, () => ({ kind: 'question', index: q++ })),
  )
}
