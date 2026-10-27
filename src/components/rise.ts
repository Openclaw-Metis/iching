import type { CSSProperties } from 'react'

/** 進場的先後順序：配合 global.css 的 .rise，每一層延後 70ms */
export const rise = (i: number) => ({ '--i': i }) as CSSProperties
