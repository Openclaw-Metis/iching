// 直排經文（規格「經冊與畫卦」）：固定字數一欄，欄間朱絲欄，由右而左讀。引的是經文，所以用 blockquote。
// 分欄的文字只給眼睛看；螢幕閱讀器讀隱藏的整段原文，不會被欄位切成一句一句。

import type { CSSProperties } from 'react'
import { splitColumns } from '../lib/columns.ts'

interface Props {
  text: string
  /** 每欄字數；句讀併入上一欄時該欄會多一兩字 */
  perColumn: number
  /** 第一欄的卷題（出處，如「蒙卦辭」），朱色小字 */
  head?: string
  className?: string
}

export function Scripture({ text, perColumn, head, className = '' }: Props) {
  const columns = splitColumns(text, perColumn)
  // 欄高取最長一欄：短的經文（如「乾，元亨利貞。」）不必撐到整欄高
  const longest = Math.max(...columns.map(c => [...c].length))
  return (
    <blockquote className={`scripture ${className}`} style={{ '--per-col': longest } as CSSProperties}>
      <p className="sr-only">{head ? `${head}：${text}` : text}</p>
      <div className="scripture-cols" aria-hidden="true" lang="zh-Hant">
        {head && <span className="scripture-head">{head}</span>}
        {columns.map((c, i) => <span key={i} className="scripture-col">{c}</span>)}
      </div>
    </blockquote>
  )
}
