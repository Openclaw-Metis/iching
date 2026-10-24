# 易經卦殿

六十四卦卦牌網站：照傳統方法問事、看得懂該讀哪段經文，再加上每日一卦、從零開始的學堂與收藏冊。網址：https://openclaw-metis.github.io/iching/

## 功能

- **卦殿**：64 張全息卦牌，可依文王卦序、上下卦、京房八宮、十二消息排列與搜尋。
- **卡牌頁**：倒轉看綜卦、翻面看錯卦、取中看互卦；牌義、經文（卦辭、大象、爻辭都有白話）、卦象、爻變與來源分頁。
- **占卜**：三枚銅錢、手動輸入、大衍筮法（親手分蓍或一鍵完成）；依朱熹規則指出主讀與輔讀，起卦中斷可接續，完成自動存入紀錄。
- **今日**：每天固定一張牌，可寫心得；下載 `.ics` 讓行事曆每天提醒。
- **學堂**：8 站 24 課與 8 場考核、看圖猜卦、XP 與每日目標、連續天數、修為等級。
- **我的**：占卜與每日紀錄（搜尋、篩選、筆記、事後回顧）、印譜、設定與備份。

**暫時隱藏的功能**：「溫故」（依 FSRS 排程複習、卦殿學習地圖、「溫」印）與「收藏」（收藏卦牌與經文句子）程式都還在，以 `src/app/flags.ts` 的開關關閉入口；資料、備份與答對時建立溫故卡照常，改回 `true` 就恢復。範圍見 `docs/spec.md`「功能開關」。

站內說明在「我的 › 設定與備份 › 使用說明」，已知問題整理在 `docs/known-issues.md`。

## 使用須知

- **資料只存在這台裝置的瀏覽器**：沒有帳號與雲端，紀錄、收藏、學習進度都在 IndexedDB。換裝置或清除網站資料前，請在「我的 › 設定與備份」匯出。
- **備份**：「匯出全部資料」存成 `iching-backup-YYYYMMDD.json`；超過 40 MB 自動分成好幾個檔（`-1of3` 這類檔名），匯入時要一起選取。匯入前會先預覽筆數，可選「合併」或「取代」；占卜保存失敗時下載的單筆結果檔只能合併。超過 30 天沒備份會提醒。
- **加到主畫面**：可離線使用，iOS 的 Safari 也不會因為 7 天沒開啟就清掉資料。步驟在「我的 › 設定與備份 › 加到主畫面與離線使用」。
- **字型**：Noto Serif TC 由 Google Fonts 提供，是網站唯一的外部請求，不會送出任何紀錄；沒有網路又沒快取過時改用裝置字型。
- **無痕視窗**：可以使用但不會保存，畫面上方會提示。

## 開發

```bash
npm install
npm run dev          # http://localhost:5181（網址加 ?seed=demo 會寫入示範資料）
npm test             # 單元與整合測試在 node（IndexedDB 用 fake-indexeddb），元件測試在 happy-dom
npm run typecheck
npm run build        # 型別檢查、建置、產生各路徑 HTML 與 404.html
npm run check:size   # 卦殿首屏 JavaScript gzip ≤ 160 KB 且不含保存層與功能模組；占卜頁 ≤ 120 KB
npm run preview      # 比照正式站（/iching/ 前綴、CSP、service worker）
npm run check:routes # 檢查正式站 102 條路徑（見「部署後的檢查」）
```

需要 Node 24 以上。長期開發規則在 `CLAUDE.md`（與 `AGENTS.md` 相同），第二階段規格與分階段計畫在 `docs/spec.md`（Stage 0 到 11 已完成），驗收對照在 `docs/qa-checklist.md`。

### 程式結構

- `src/app/routes.ts`：全站路徑的唯一定義（102 條），前端路由、建置時的各路徑 HTML 與部署後檢查共用。卦殿以外的頁面都延遲載入，導覽由 `src/app/nav.ts` 的旗標控制。
- `src/pages`：各頁的外殼；功能放在 `src/features/<名稱>`（`divination`、`records`、`backup`、`daily`、`academy`、`review`、`collection`），只從各自的 `index.ts` 對外匯出。
- `src/storage`：使用者資料只存在瀏覽器的 IndexedDB（Dexie 管理 16 張資料表），也只有這個資料夾能碰 IndexedDB。資料庫版本比程式新或升級失敗時停止寫入；只有 IndexedDB 不能用（隱私模式）時才改用記憶體資料庫。
- `src/data`：卦象、原文、牌義、450 條白話（`lines.json`，以 `fetch` 載入）、學堂課程在 `src/features/academy/lessons`。
- `src/lib`：亂數（`crypto.getRandomValues` 加拒絕取樣）、本地日期、引文正規化、錯誤碼。

### 資料表版本只升不降

`src/storage/db.ts` 的 `db.version(n)` 一旦部署就不能改回較小的數字：使用者瀏覽器裡的資料庫已經升級，舊程式打不開（會顯示「網站已更新，請重新整理頁面」並停止寫入）。新增資料表或欄位時：

1. 宣告 `db.version(n + 1)` 並寫 `upgrade` 函式，不修改舊版本的宣告。
2. 同步更新備份格式（`src/features/backup/format.ts`）、匯入驗證（`validate.ts`）與合併規則（`merge.ts`）。
3. 補上升級與備份往返的測試。

## 部署

網站部署在 GitHub Pages：https://openclaw-metis.github.io/iching/

推送到 `main` 時，`.github/workflows/deploy.yml` 會跑測試、建置、首屏體積檢查並部署。正式版的路徑前綴是 `/iching/`（`vite.config.ts` 的 `base`），本機開發仍用根路徑；`npm run preview` 會比照正式版。

- **各路徑 HTML**：建置後 `scripts/build/route-pages.mjs` 依 `routes.ts` 替每條路徑寫一份 `<路徑>.html`，帶入該頁標題與描述。GitHub Pages 對不帶副檔名的網址會直接回應同名 `.html`（200），若寫成 `<路徑>/index.html` 會先 301 轉到結尾斜線，所以只有同時是目錄的 `/academy` 另寫 `academy/index.html`。不在路徑表裡的網址落到 `404.html`，由前端顯示「找不到這一頁」。
- **CSP**：只在正式建置時注入 `index.html`（開發模式的 React 熱更新會插入內嵌腳本）；除網站本身與 Google Fonts 外不允許其他來源。
- **部署包瘦身**：已有插圖的卡用分層貼圖顯示，整張的 `face.webp` 不放進 `dist`。
- **離線版**：`vite-plugin-pwa`（generateSW）產生 `sw.js` 與 `manifest.webmanifest`。預先快取 `index.html`、全部程式與白話（`assets/**/*.{js,css,json}`）、64 張縮圖、64 張看圖卡與圖示；卡圖四層（`card-layers`）與 Google Fonts 在用到時才快取，`src/app/cardCache.ts` 只保留最近 30 卦的四層。註冊與新版本提示在 `src/app/UpdateToast.tsx`，有新版本時由使用者按「重新整理」才更新。圖示由 `node scripts/build/icons.mjs` 從 `public/favicon.svg` 產生。

### 部署後的檢查

1. `npm run check:routes`：依 `src/app/routes.ts` 請求正式站的 102 個網址，確認都直接回 200 且 `<title>` 正確（AC-23）。本機可用 `npm run check:routes -- http://localhost:4173` 檢查 `npm run preview`。
2. 其餘手動項目（Safari、離線、安裝、.ics 匯入）見 `docs/qa-checklist.md`。

### 離線版出問題時的回滾

service worker 一旦裝上，即使撤回程式，使用者的瀏覽器仍會用舊的快取。要撤掉它：

1. 在 `vite.config.ts` 的 `VitePWA({ ... })` 加上 `selfDestroying: true`，推送部署。這一版的 service worker 會在使用者下次開啟時解除註冊並清掉快取。
2. 確認大部分使用者都已開過一次之後，修正設定，移除 `selfDestroying` 再部署。

### 程式出問題時的回滾

以 `git revert` 撤回有問題的提交再推送 `main`，但 `db.ts` 的資料表版本宣告不可倒退；問題牽涉資料表變更時，改以修正版往前部署，不部署舊程式。使用者資料在各自的瀏覽器裡，不受網站回滾影響。

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
