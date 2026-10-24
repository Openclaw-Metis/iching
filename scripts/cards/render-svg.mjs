// 以 resvg 把 SVG 字串轉成 PNG；字型固定用 Noto Serif TC（SIL OFL 1.1，Windows 11 內建）。
import { existsSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const FONT_FILE = process.env.ICHING_FONT ?? 'C:/Windows/Fonts/NotoSerifTC-VF.ttf'

export function renderSvg(svg, width) {
  if (!existsSync(FONT_FILE)) throw new Error(`找不到字型 ${FONT_FILE}，請用 ICHING_FONT 指定 Noto Serif TC 的路徑`)
  const resvg = new Resvg(svg, {
    fitTo: width ? { mode: 'width', value: width } : { mode: 'original' },
    font: { fontFiles: [FONT_FILE], loadSystemFonts: false, defaultFontFamily: 'Noto Serif TC' },
  })
  return resvg.render().asPng()
}
