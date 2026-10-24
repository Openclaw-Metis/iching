# 易經卦殿

六十四卦卦牌網站：卦牌展廳、全息卡詳細頁（倒轉看綜卦、翻面看錯卦、取中看互卦）、經文與爻變。之後會加上占卜、每日一卦、學堂與收藏。

## 開發

```bash
npm install
npm run dev          # http://localhost:5181（網址加 ?seed=demo 會寫入示範資料）
npm test             # 單元與整合測試在 node（IndexedDB 用 fake-indexeddb），元件測試在 happy-dom
npm run typecheck
npm run build        # 型別檢查、建置、產生各路徑 HTML 與 404.html
npm run check:size   # 卦殿首屏 JavaScript gzip ≤ 160 KB，且不含保存層與功能模組
npm run preview      # 比照正式站（/iching/ 前綴、CSP）
```

需要 Node 24 以上。長期開發規則在 `CLAUDE.md`（與 `AGENTS.md` 相同），第二階段規格與分階段計畫在 `docs/spec.md`。

### 程式結構

- `src/app/routes.ts`：全站路徑的唯一定義（102 條），前端路由、建置時的各路徑 HTML 與部署後檢查共用。卦殿以外的頁面都延遲載入，尚未完成的頁面先顯示「即將推出」，導覽由 `src/app/nav.ts` 的旗標控制。
- `src/storage`：使用者資料只存在瀏覽器的 IndexedDB（Dexie 管理 16 張資料表）。資料庫版本比程式新或升級失敗時停止寫入；只有 IndexedDB 不能用（隱私模式）時才改用記憶體資料庫。資料表版本只升不降，變動一律以新版號加升級函式處理。
- `src/lib`：亂數（`crypto.getRandomValues` 加拒絕取樣）、本地日期、引文正規化、錯誤碼。

## 部署

網站部署在 GitHub Pages：https://openclaw-metis.github.io/iching/

推送到 `main` 時，`.github/workflows/deploy.yml` 會跑測試、建置、首屏體積檢查並部署。正式版的路徑前綴是 `/iching/`（`vite.config.ts` 的 `base`），本機開發仍用根路徑；`npm run preview` 會比照正式版。

- **各路徑 HTML**：建置後 `scripts/build/route-pages.mjs` 依 `routes.ts` 替每條路徑寫一份 `<路徑>.html`，帶入該頁標題與描述。GitHub Pages 對不帶副檔名的網址會直接回應同名 `.html`（200），若寫成 `<路徑>/index.html` 會先 301 轉到結尾斜線，所以只有同時是目錄的 `/academy` 另寫 `academy/index.html`。不在路徑表裡的網址落到 `404.html`，由前端顯示「找不到這一頁」。
- **CSP**：只在正式建置時注入 `index.html`（開發模式的 React 熱更新會插入內嵌腳本）；除網站本身與 Google Fonts 外不允許其他來源。
- **部署包瘦身**：已有插圖的卡用分層貼圖顯示，整張的 `face.webp` 不放進 `dist`。

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
