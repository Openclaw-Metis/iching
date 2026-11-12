// 民間占斷的資料檢查（規格「問事指引的民間占斷」）。

import { describe, expect, it } from 'vitest'
import data from './folk.json'
import type { FolkReading } from './folk.ts'

const entries = Object.entries(data as Record<string, FolkReading>)
const len = (s: string) => [...s].length

describe('民間占斷', () => {
  it('64 卦都有', () => {
    expect(entries.map(([n]) => Number(n)).sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i + 1))
  })

  it('每一卦有稱呼、總斷與養生提醒，長度在規格內，不用引號與破折號', () => {
    const problems: string[] = []
    for (const [n, c] of entries) {
      const { title, ...texts } = c
      if (!/^.{2}之數$/u.test(title)) problems.push(`${n} 稱呼 ${title}`)
      if (!texts.decision || !texts.wellness) problems.push(`${n} 缺總斷或養生提醒`)
      for (const [k, v] of Object.entries(texts)) {
        if (len(v) < 4 || len(v) > 80) problems.push(`${n} ${k} ${len(v)}`)
        if (/[「」—]|――/.test(v)) problems.push(`${n} ${k} 用了引號或破折號`)
      }
    }
    expect(problems).toEqual([])
  })

  it('養生提醒不寫病名', () => {
    const named = entries.filter(([, c]) => /[炎癌瘤]|硬化|梗塞|潰瘍|出血|穿孔|結石|中風|糖尿|高血壓|低血壓|貧血|痔|疏鬆|失調|憂鬱|腫瘤|肌瘤/.test(c.wellness)).map(([n]) => n)
    expect(named).toEqual([])
  })
})
