---
version: alpha
name: 易經卦殿
description: 墨底泥金的寫經冊；六十四卦卦牌圖錄、占卜、學堂與占卜紀錄的離線網頁應用
colors:
  primary: "#eeedea"
  on-primary: "#10100f"
  secondary: "#c8ab73"
  secondary-high: "#e5d2a5"
  secondary-low: "#947c50"
  tertiary: "#d98b77"
  neutral: "#10100f"
  surface: "#181714"
  surface-high: "#22201c"
  surface-highest: "#2d2b26"
  on-surface: "#deddd9"
  on-surface-variant: "#b8b2a8"
  on-surface-faint: "#a19b91"
  outline: "#57544c"
  outline-variant: "#2d2b26"
  rule: "#5e3a31"
  rule-high: "#8c5142"
  celadon: "#abc0b5"
  success: "#9cc3a6"
typography:
  headline-lg:
    fontFamily: Noto Serif TC
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: 0.06em
  headline-md:
    fontFamily: Noto Serif TC
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.4
  scripture-md:
    fontFamily: Noto Serif TC
    fontSize: 26px
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: 0.08em
  body-lg:
    fontFamily: system-ui
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.8
  body-sm:
    fontFamily: system-ui
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.7
  label-sm:
    fontFamily: system-ui
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
spacing:
  base: 16px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 72px
  gutter: 48px
  page-width: 1200px
rounded:
  sm: 4px
  md: 8px
  pill: 999px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
  scripture-frame:
    textColor: "{colors.secondary-high}"
    typography: "{typography.scripture-md}"
---

## Overview

介面是一部墨底泥金的寫經冊。經文以直排金字配朱絲欄呈現，是畫面的主角；白話、說明與操作像注疏，用橫排的系統字跟在旁邊。卦是由下而上一爻一爻成形的，畫卦、起卦、卦畫進場都照這個方向動。色彩只花在卦畫、經文、關係與狀態上，一般控制元件維持中性的墨色表面，唯一的主按鈕是白底黑字的長圓按鈕。來源：`src/styles/global.css`、`docs/spec.md`「經冊與畫卦」、`docs/ui-design.md`。

## Colors

- **Primary (#eeedea)**：象牙白。頁面標題、主按鈕底色、目前選取的分頁文字。
- **On-primary (#10100f)**：主按鈕上的字。
- **Secondary (#c8ab73)**：古董金。陰陽爻、卦畫、學堂已通過的路段、分節編號。
- **Secondary-high (#e5d2a5)**：亮金。直排經文的字、焦點框、卦名強調。
- **Secondary-low (#947c50)**：暗金。蓍草、畫卦按鈕懸停時的外框。
- **Tertiary (#d98b77)**：朱紅。變爻、導覽與分頁的目前項目底線、危險操作文字、學堂下一段路線。
- **Neutral (#10100f)**：頁面底色（墨黑，不用純黑）。
- **Surface (#181714) / Surface-high (#22201c) / Surface-highest (#2d2b26)**：面板、懸停、選取三層。
- **On-surface (#deddd9)**：內文。**On-surface-variant (#b8b2a8)**：說明。**On-surface-faint (#a19b91)**：輸入框提示與未開放項目。
- **Outline (#57544c) / Outline-variant (#2d2b26)**：控制元件外框與分隔線。
- **Rule (#5e3a31) / Rule-high (#8c5142)**：朱絲欄、經文外框、尚未畫上的爻位虛線。
- **Celadon (#abc0b5)**：綜卦關係、儲存成功、次要連結。**Success (#9cc3a6)**：作答正確。

## Typography

- **headline-lg**：Noto Serif TC 32px（手機 26px），每頁只有一個頁面標題。
- **headline-md**：Noto Serif TC 20px，區段標題。
- **scripture-md**：直排經文 26px，依位置在 19 到 27px 之間（卦殿預覽最小、卡牌頁卦辭最大）。
- **body-lg**：系統字 16px、行高 1.8，所有內文。這是使用者先前定下的方向：品牌特色來自卦牌、卦畫與經文，操作用系統字。
- **body-sm / label-sm**：14px 說明、13px 標籤，不再更小。

## Layout

- 版頭與內容共用 1200px 欄寬，左右邊界 clamp(20px, 3.5vw, 48px)；所有頁面從同一條左緣起。
- 斷點 1200、1100、1000、900、600px；600px 以下為手機版。
- 主要區塊依序上升 16px 進場（間隔 70ms），減少動態效果時停用。

## Shapes

- 控制元件 4px 圓角；主按鈕長圓（999px）；對話框 8px。卡牌圖保持 5:7。

## Components

- **button-primary**：象牙白長圓按鈕，每個畫面最多一顆。
- **scripture-frame**：直排經文，固定字數分欄，句讀不落欄首，四周與欄間朱絲欄，朱色小字卷題。
- **forge**：六個爻位，初爻在下；空位是朱絲虛線，畫上後為金色，變爻朱紅；可載入 Three.js 金粉。

## Do's and Don'ts

**Do**
- 經文直排、放大，讓它成為畫面主角；白話放旁邊。
- 卦畫一律依資料繪製，初爻在下。
- 狀態用文字寫清楚（未開放、可學、已存入紀錄），不只靠顏色。

**Don't**
- 不用漸層、玻璃、光暈或陰影堆層次；層次靠墨色表面三層與朱絲欄。
- 不用 emoji 或符號當介面元素（★、☆ 已改成文字）。
- 不虛構數字；畫面上的統計都要能從本機資料算出來。
