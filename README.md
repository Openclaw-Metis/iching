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

## 部署

網站部署在 GitHub Pages：https://openclaw-metis.github.io/iching/

推送到 `main` 時，`.github/workflows/deploy.yml` 會跑測試、建置並部署。正式版的路徑前綴是 `/iching/`（`vite.config.ts` 的 `base`），本機開發仍用根路徑；`npm run preview` 會比照正式版。Pages 不支援單頁應用的路由，建置時會把 `index.html` 複製成 `404.html`，直接打開 `/iching/gua/3` 這類網址也能載入。

## 資料

- `易經_周易_原文.md`：經傳原文，底本為王弼《周易注》。`npm run data:classic` 解析成 `src/data/classic.json`。
- `src/data/hexagrams.ts`：六十四卦結構，全部由六爻推算（上下卦、錯綜互、八宮、先天序、消息卦）。
- `src/data/xugua.ts`：序卦傳、雜卦傳依卦拆分。
- `src/data/content.json`：本站原創的 64 卦牌義（關鍵詞、一句話牌義、整體牌義、白話導讀、問事指引），型別在 `src/data/content.ts`，`content.test.ts` 會核對長度與引文。
- `docs/hexagram-review.md`：Claude、Codex、agy 三方對 64 卦卦義與卡面的檢視紀錄與重繪決定，原始評審在 `docs/review/`。
- `docs/content-review.md`：三方撰寫與複審牌義的過程與主要修正，原始稿件在 `docs/review/content-round*.json`。

## 卡牌

每張卡由三層組成，畫布 1000×1400（5:7）：

1. 背景：上卦面板疊在下卦面板之上（`art/raw/panels/<八卦 id>.png`，3:2）。
2. 主體：透明背景插圖（`art/raw/subjects/<兩位數卦序>.png`，2:3），依 alpha 外框自動放進插圖視窗，`art/placements.json` 可逐卡微調 `scale`、`dx`、`dy`。
3. 卡框與文字：`scripts/cards/card-face.mjs` 以 SVG 繪製，卦畫由卦象資料產生。上下兩條題框等高，插圖區以上下卦的分界線為中心，兩卦背景露出一樣多，主體也擺在正中央。

```bash
npm run cards:build          # 全部 64 卦
npm run cards:build -- 5 6   # 只建置指定卦
```

建置會呼叫 webgl-holo-card skill 的 `holo_card.py prepare` 整理圖層、`build` 產生單張 `cards/holo/<卦序>/dist/card.html`，再輸出網站貼圖到 `public/cards/<卦序>/` 與 `src/data/cards.json`。沒有主體插圖的卦會輸出佔位卡。

字型使用 Noto Serif TC（SIL OFL 1.1），預設讀 `C:/Windows/Fonts/NotoSerifTC-VF.ttf`，其他環境以 `ICHING_FONT` 指定。skill 路徑預設為 `~/.claude/skills/webgl-holo-card`，可用 `HOLO_CARD` 指定。

插圖以 Codex image_gen 生成。每卦的畫面設計（中文說明與英文提示詞）、八張面板的提示詞與統一畫風都在 `src/data/art-direction.json`，網站的「卡面」說明也讀這份資料。

重繪某幾張時，先產生批次提示檔，再讓互動式 Codex 讀檔逐張生成（終端只收單行 ASCII，提示詞因此放在檔案裡）：

```bash
node scripts/cards/codex-batch.mjs C:/Users/jimai/exports/iching redo 7 panel:li
```

已存在的輸出檔會被略過，不會覆寫。
