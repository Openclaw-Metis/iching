// 卡牌貼圖路徑。cards.json 由 scripts/cards/build-cards.mjs 產生，標記哪些卦已有插圖。
import manifest from './cards.json'

const art = manifest as Record<string, { art: boolean }>
const pad = (n: number) => String(n).padStart(2, '0')
const base = import.meta.env.BASE_URL

export type CardLayer = 'background' | 'subject' | 'fx' | 'text' | 'face' | 'thumb'

export const hasArt = (n: number) => Boolean(art[n]?.art)
export const cardAsset = (n: number, layer: CardLayer) => `${base}cards/${pad(n)}/${layer}.webp`
export const deckBack = `${base}cards/back.webp`
export const illustratedCount = Object.values(art).filter(c => c.art).length
