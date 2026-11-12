// 問事指引裡的民間占斷（規格「問事指引的民間占斷」）：和本站的指引分開、每一行都標明，
// 讀的人才分得出哪些是本站的說法、哪些是坊間的斷語。卡牌頁與解讀頁共用。
// 資料另外載入；還沒載到或載入失敗時整組不顯示，本站的指引照常。

import { useEffect, useState } from 'react'
import { loadFolk, type FolkReading } from '../data/folk.ts'

type Facet = 'career' | 'relations' | 'decision'

export function useFolk(hexagram: number): FolkReading | undefined {
  const [loaded, setLoaded] = useState<{ hexagram: number; folk: FolkReading | undefined } | null>(null)
  useEffect(() => {
    let alive = true
    loadFolk().then(data => { if (alive) setLoaded({ hexagram, folk: data[hexagram] }) }, () => {})
    return () => { alive = false }
  }, [hexagram])
  return loaded?.hexagram === hexagram ? loaded.folk : undefined
}

/** 接在某個面向的指引後面；總斷帶出民間稱呼。原資料沒提到的面向不顯示 */
export function FolkLine({ folk, facet }: { folk: FolkReading | undefined; facet: Facet }) {
  const text = folk?.[facet]
  if (!folk || !text) return null
  return <p className="folk-line"><b>民間占斷</b>{facet === 'decision' && `${folk.title}。`}{text}</p>
}

/** 清單的最後一項：身體與作息 */
export function FolkWellness({ folk }: { folk: FolkReading | undefined }) {
  if (!folk) return null
  return <><dt>身體與作息</dt><dd>{folk.wellness}</dd></>
}

export function FolkNote({ folk }: { folk: FolkReading | undefined }) {
  if (!folk) return null
  return <p className="note folk-note">民間占斷取自坊間流傳的占卜說法，經本站改寫，斷語與月份（多指農曆）僅供參考；身體與作息是一般的養生提醒，不是醫療建議。</p>
}
