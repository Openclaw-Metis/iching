// 全站路徑的唯一定義。前端路由表（main.tsx）、建置時替每條路徑產生 index.html 的 route-pages，
// 以及部署後逐一檢查狀態碼的 check-routes 都讀這份清單，新增頁面只改這裡。
// 這個檔案要能直接被 Node 匯入（建置腳本），所以只匯入不含 JSON 的資料模組。

import { hexagrams } from '../data/hexagrams.ts'
import { FLAGS } from './flags.ts'
import { LESSON_IDS, parseLessonId, STATION_NUMERALS, STATIONS } from '../data/stations.ts'

export type PageId = 'hall' | 'card' | 'today' | 'divine' | 'academy' | 'me' | 'lesson' | 'exam' | 'review'

export const SITE_NAME = '易經卦殿'

/** 各頁在前端路由的路徑樣式 */
export const PATTERNS: Record<PageId, string> = {
  hall: '/',
  card: '/gua/:number',
  today: '/today',
  divine: '/divine',
  academy: '/academy',
  me: '/me',
  lesson: '/academy/lesson/:id',
  exam: '/academy/exam/:station',
  review: '/academy/review',
}

export interface RouteEntry {
  path: string
  page: PageId
  /** 分頁標題（document.title 與靜態 index.html 的 <title>） */
  title: string
  /** meta description；卡牌頁在建置時改用 content.json 的一句話牌義（見 scripts/build/route-pages.mjs） */
  description: string
  /** 卡牌頁的卦序，讓建置腳本找到對應的牌義 */
  hexagram?: number
}

const titled = (name: string) => `${name}｜${SITE_NAME}`

export const routes: RouteEntry[] = [
  { path: '/', page: 'hall', title: `${SITE_NAME}｜六十四卦卦牌`, description: '易經六十四卦卦牌展廳：看卦象、讀經文、翻轉綜卦與錯卦。' },
  { path: '/today', page: 'today', title: titled('今日一卦'), description: '每天翻一張卦牌，當天固定不變，可以寫下一句今日心得。' },
  { path: '/divine', page: 'divine', title: titled('占卜'), description: '寫下想問的事，用三錢法或大衍筮法起卦，依朱熹讀法找到該讀的經文。' },
  { path: '/academy', page: 'academy', title: titled('學堂'), description: `八站修行路線，從陰陽與八卦學到占法${FLAGS.review ? '，學過的卦會安排溫故複習' : ''}。` },
  { path: '/me', page: 'me', title: titled('我的'), description: `占卜紀錄、${FLAGS.collection ? '收藏、' : ''}印譜與備份，資料只存在這台裝置。` },
  ...hexagrams.map((h): RouteEntry => ({
    path: `/gua/${h.number}`,
    page: 'card',
    title: titled(`${h.name}・${h.fullName}`),
    description: `第${h.number}卦${h.fullName}：卦辭、爻辭、牌義與卦象。`,
    hexagram: h.number,
  })),
  ...LESSON_IDS.map((id): RouteEntry => {
    const { station, title } = parseLessonId(id)!
    return {
      path: `/academy/lesson/${id}`,
      page: 'lesson',
      title: titled(`${title}・第${STATION_NUMERALS[station.id - 1]}站`),
      description: `學堂第${STATION_NUMERALS[station.id - 1]}站「${station.theme}」：${title}。`,
    }
  }),
  ...STATIONS.map((s): RouteEntry => ({
    path: `/academy/exam/${s.id}`,
    page: 'exam',
    title: titled(`第${STATION_NUMERALS[s.id - 1]}站考核・${s.theme}`),
    description: `學堂第${STATION_NUMERALS[s.id - 1]}站「${s.theme}」的考核：十題答對八題即通過。`,
  })),
  { path: '/academy/review', page: 'review', title: titled('溫故'), description: '依記憶程度安排的卦牌複習。' },
]

const byPath = new Map(routes.map(r => [r.path, r]))

/** 依網址路徑（不含 base）找到路徑定義；結尾斜線不影響 */
export const routeFor = (pathname: string) => byPath.get(pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname)

export const titleFor = (pathname: string) => routeFor(pathname)?.title ?? SITE_NAME
