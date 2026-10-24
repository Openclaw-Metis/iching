// 學堂修行路線的站點與課名（規格「學堂內容設計」）。沿先天八卦順序走 8 站，每站 3 課、1 場考核。
// 路徑表、標題與學堂功能共用這份資料；課程的閱讀段落與題型參數在 features/academy 的課程 JSON。

export interface Station {
  /** 站號 1 到 8 */
  id: number
  /** 站名用的八卦 */
  trigram: string
  theme: string
  lessons: [string, string, string]
  /** 通過本站考核後的修為 */
  rank: string
}

export const STATIONS: Station[] = [
  { id: 1, trigram: '乾', theme: '陰陽與爻', lessons: ['陽爻與陰爻', '爻位由下而上', '九與六的稱呼'], rank: '識爻' },
  { id: 2, trigram: '兌', theme: '八卦', lessons: ['八卦卦畫', '自然象徵', '性情與家人'], rank: '識卦' },
  { id: 3, trigram: '離', theme: '重卦', lessons: ['上下卦疊成一卦', '卦名讀法', '八純卦與看圖認卦'], rank: '成卦' },
  { id: 4, trigram: '震', theme: '卦序', lessons: ['上經與下經', '兩兩相對', '序卦串場'], rank: '明序' },
  { id: 5, trigram: '巽', theme: '錯綜互', lessons: ['錯卦', '綜卦', '互卦'], rank: '通變' },
  { id: 6, trigram: '坎', theme: '經與傳', lessons: ['卦辭與爻辭', '彖傳與大象', '文言與十翼'], rank: '讀經' },
  { id: 7, trigram: '艮', theme: '爻位', lessons: ['當位與不當位', '中爻', '應與比'], rank: '觀位' },
  { id: 8, trigram: '坤', theme: '占法', lessons: ['三錢法', '大衍筮法', '朱熹變爻讀法'], rank: '知占' },
]

/** 起始修為 */
export const FIRST_RANK = '學徒'

export const STATION_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八']

/** 課號：S2-L1 是第二站第一課 */
export const lessonId = (station: number, lesson: number) => `S${station}-L${lesson}`

export function parseLessonId(id: string): { station: Station; index: number; title: string } | null {
  const m = /^S([1-8])-L([1-3])$/.exec(id)
  if (!m) return null
  const station = STATIONS[Number(m[1]) - 1]
  const index = Number(m[2])
  return { station, index, title: station.lessons[index - 1] }
}

export const LESSON_IDS = STATIONS.flatMap(s => s.lessons.map((_, i) => lessonId(s.id, i + 1)))
