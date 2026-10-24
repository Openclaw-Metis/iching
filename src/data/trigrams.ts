// 八卦。爻由下而上排列，1 為陽爻、0 為陰爻。
// 象、性情、動物、身體、家人取自《說卦傳》；方位為後天八卦（文王八卦）方位。

export type TrigramId = 'qian' | 'dui' | 'li' | 'zhen' | 'xun' | 'kan' | 'gen' | 'kun'
export type Bit = 0 | 1

export interface Trigram {
  id: TrigramId
  name: string
  /** 自然之象 */
  image: string
  lines: [Bit, Bit, Bit]
  /** 先天八卦序（乾一兌二離三震四巽五坎六艮七坤八） */
  fuxi: number
  nature: string
  animal: string
  body: string
  family: string
  direction: string
  element: '金' | '木' | '水' | '火' | '土'
  /** 卡框與展廳用色：低飽和礦物色 */
  color: string
}

export const trigrams: Trigram[] = [
  { id: 'qian', name: '乾', image: '天', lines: [1, 1, 1], fuxi: 1, nature: '健', animal: '馬', body: '首', family: '父', direction: '西北', element: '金', color: '#c9ad72' },
  { id: 'dui', name: '兌', image: '澤', lines: [1, 1, 0], fuxi: 2, nature: '說', animal: '羊', body: '口', family: '少女', direction: '西', element: '金', color: '#9fb2ad' },
  { id: 'li', name: '離', image: '火', lines: [1, 0, 1], fuxi: 3, nature: '麗', animal: '雉', body: '目', family: '中女', direction: '南', element: '火', color: '#a84a35' },
  { id: 'zhen', name: '震', image: '雷', lines: [1, 0, 0], fuxi: 4, nature: '動', animal: '龍', body: '足', family: '長男', direction: '東', element: '木', color: '#5f7f66' },
  { id: 'xun', name: '巽', image: '風', lines: [0, 1, 1], fuxi: 5, nature: '入', animal: '雞', body: '股', family: '長女', direction: '東南', element: '木', color: '#6f938e' },
  { id: 'kan', name: '坎', image: '水', lines: [0, 1, 0], fuxi: 6, nature: '陷', animal: '豕', body: '耳', family: '中男', direction: '北', element: '水', color: '#41586d' },
  { id: 'gen', name: '艮', image: '山', lines: [0, 0, 1], fuxi: 7, nature: '止', animal: '狗', body: '手', family: '少男', direction: '東北', element: '土', color: '#7b5539' },
  { id: 'kun', name: '坤', image: '地', lines: [0, 0, 0], fuxi: 8, nature: '順', animal: '牛', body: '腹', family: '母', direction: '西南', element: '土', color: '#9b7d4e' },
]

export const trigramById = Object.fromEntries(trigrams.map(t => [t.id, t])) as Record<TrigramId, Trigram>

export function trigramOf(lines: readonly Bit[]): Trigram {
  const found = trigrams.find(t => t.lines.every((b, i) => b === lines[i]))
  if (!found) throw new Error(`不是三爻：${lines.join('')}`)
  return found
}
