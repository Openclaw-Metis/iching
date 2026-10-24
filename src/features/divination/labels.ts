import type { Category, DraftMethod, Method } from '../../storage/index.ts'

export const CATEGORY_ORDER: Category[] = ['career', 'relations', 'decision', 'general']

export const CATEGORY_LABELS: Record<Category, string> = {
  career: '事業與學業',
  relations: '感情與人際',
  decision: '行動與決策',
  general: '不分類',
}

export const DRAFT_METHOD_LABELS: Record<DraftMethod, string> = {
  coins: '三錢法',
  yarrow: '大衍筮法',
  manual: '手動輸入',
}

export const METHOD_LABELS: Record<Method, string> = {
  coins: '三錢法',
  'yarrow-hand': '大衍筮法（親手分蓍）',
  'yarrow-quick': '大衍筮法（一鍵完成）',
  manual: '手動輸入',
}

export const METHOD_HELP: Record<DraftMethod, string> = {
  coins: '三枚銅錢同時擲，正面算 3、背面算 2，三枚相加得到 6 到 9。6 是老陰、9 是老陽，兩者都會變，各占八分之一；少陽 7 與少陰 8 各占八分之三。',
  yarrow: '依《繫辭》「大衍之數五十，其用四十有九」的古法，四十九根蓍草經三變得一爻，十八變成一卦。老陽（十六分之三）比老陰（十六分之一）常見，少陰占十六分之七、少陽占十六分之五。親手分蓍時每一變由你點選分開的位置，程式完成掛一、揲四、歸奇，機率由你的手決定；一鍵完成由程式依古法的理論機率代為分蓍，再播放過程。',
  manual: '用你自己的三枚銅錢擲，每擲一次就點選有幾枚正面。換算方式和三錢法相同。',
}

export const MANUAL_RULE = '本站換算：正面 3、背面 2，三枚相加。0 枚正面為 6（老陰，會變）、1 枚為 7（少陽）、2 枚為 8（少陰）、3 枚為 9（老陽，會變）。'

export const LINE_NAMES = { 6: '老陰', 7: '少陽', 8: '少陰', 9: '老陽' } as const
