# 易經卦殿

六十四卦卦牌網站：卦牌展廳、全息卡詳細頁（倒轉看綜卦、翻面看錯卦）、經文與爻變。之後會加上占卜、每日一卦、學堂與收藏。

## 開發

```bash
npm install
npm run dev        # http://localhost:5181
npm test
npm run build
```

需要 Node 24 以上。

## 資料

- `易經_周易_原文.md`：經傳原文，底本為王弼《周易注》。`npm run data:classic` 解析成 `src/data/classic.json`。
- `src/data/hexagrams.ts`：六十四卦結構，全部由六爻推算（上下卦、錯綜互、八宮、先天序、消息卦）。
- `src/data/xugua.ts`：序卦傳、雜卦傳依卦拆分。
- `src/data/content.ts`：本站原創的白話導讀與牌義，尚未撰寫的卦不在表內。

## 卡牌

每張卡由三層組成，畫布 1000×1400（5:7）：

1. 背景：上卦面板疊在下卦面板之上（`art/raw/panels/<八卦 id>.png`，3:2）。
2. 主體：透明背景插圖（`art/raw/subjects/<兩位數卦序>.png`，2:3），依 alpha 外框自動放進插圖視窗，`art/placements.json` 可逐卡微調 `scale`、`dx`、`dy`。
3. 卡框與文字：`scripts/cards/card-face.mjs` 以 SVG 繪製，卦畫由卦象資料產生。

```bash
npm run cards:build          # 全部 64 卦
npm run cards:build -- 5 6   # 只建置指定卦
```

建置會呼叫 webgl-holo-card skill 的 `holo_card.py prepare` 整理圖層、`build` 產生單張 `cards/holo/<卦序>/dist/card.html`，再輸出網站貼圖到 `public/cards/<卦序>/` 與 `src/data/cards.json`。沒有主體插圖的卦會輸出佔位卡。

字型使用 Noto Serif TC（SIL OFL 1.1），預設讀 `C:/Windows/Fonts/NotoSerifTC-VF.ttf`，其他環境以 `ICHING_FONT` 指定。skill 路徑預設為 `~/.claude/skills/webgl-holo-card`，可用 `HOLO_CARD` 指定。

插圖以 Codex image_gen 生成，統一畫風描述：

> Vienna Secession and Art Nouveau symbolist style fused with Eastern ink wash mood, Byzantine flat sacred composition, delicate cloisonne enamel gold metal outlines, flowing botanical vine curves, gilded gold leaf flakes, precise geometric ornament and inlaid jewel cabochons, soft diluted ink wash in the shadows, low saturation antique mineral palette of antique gold, ink black, grey blue and ochre with one small accent of vermilion seal red, restrained, serene, luxurious antique jewelry decorative art.
