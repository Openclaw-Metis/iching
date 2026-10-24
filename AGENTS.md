# 易經卦殿：專案長期規則

給 Codex 與 Claude Code 的共通規則（`CLAUDE.md` 與本檔內容相同，修改時兩份一起改）。規格在 `docs/spec.md`，開發筆記在 `devnote.md`。

## 共通規則

- 介面與文件用繁體中文；不使用破折號；引文照 `易經_周易_原文.md` 的用字與斷句。
- 規格以 `docs/spec.md` 為準；和規格不同的決定先寫進該檔再實作。
- `src` 內相對匯入帶副檔名；功能模組只從 `index.ts` 對外匯出；只有 `src/storage` 能碰 IndexedDB。
- 卦殿首屏（`Hall`、`Layout` 與它們的靜態匯入）不得靜態匯入 `src/storage`、`src/features/*` 與 `ts-fsrs`；卦殿以外的頁面在 `main.tsx` 一律以 `React.lazy` 載入。
- 路徑只在 `src/app/routes.ts` 定義，路由表、`route-pages` 與 `check-routes` 共用。
- 經文一律以 `textOf(n)`（`src/data/classic.ts`）取用；爻位用原始索引 0 到 5（初爻為 0），不可用畫面倒序後的索引。
- 資料表主鍵不用自動編號；布林與可為 null 的欄位不建索引；會被多個分頁修改的資料，寫入時在同一個 `readwrite` 交易內比對 `rev`。
- 每新增資料表或欄位，同步更新 `db.ts` 版本與升級函式、備份格式、匯入驗證與合併規則；資料表版本只升不降。
- 每個階段完成時：`npm test`、`npm run typecheck`、`npm run build` 全過，並以 375px 與 1280px 在瀏覽器實測。
- 新頁面在 `src/app/nav.ts` 以 `enabled` 旗標控制是否出現在導覽；階段驗收通過才打開。
- 暫時不提供的功能以 `src/app/flags.ts` 的開關隱藏入口與畫面上的提及，資料、備份與背景邏輯照常（見規格「功能開關」）。
- 不使用語言模型生成網站內容；若日後加入，必須以 Streaming 呈現。
- 使用者沒有要求就不 commit、不 push。

## 常用指令

```bash
npm install
npm run dev          # http://localhost:5181（根路徑，不注入 CSP）
npm test             # vitest：*.test.ts 在 node（IndexedDB 用 fake-indexeddb），*.test.tsx 在 happy-dom
npm run typecheck    # 兩份 tsconfig：網站程式與 node 端（測試、vite.config、建置腳本）
npm run build        # 型別檢查後建置；建置後產生各路徑 HTML、404.html，並移除用不到的 face.webp
npm run check:size   # 卦殿首屏 JavaScript gzip ≤ 160 KB，且不含保存層、功能模組、Dexie、ts-fsrs
npm run preview      # 比照正式站的 /iching/ 前綴與 CSP
```

需要 Node 24 以上（建置腳本直接匯入 `src/app/routes.ts`，靠 Node 的型別剝除）。

## 程式風格

- 兩格縮排、無分號、單引號；註解只寫原因、限制與不明顯的邏輯。
- 元件與頁面用 PascalCase（`DivineFlow.tsx`）；函式模組用 camelCase（`yarrow.ts`）；測試與被測檔放同一層，加 `.test.ts(x)`。
- 靜態檢查以 TypeScript 嚴格模式為準，格式由 `.editorconfig` 固定；不另外引入 ESLint 或 Prettier。

## 目錄分層（依賴只能往下）

1. `src/pages`：路由頁，只組合功能模組。
2. `src/features/*`：各功能的元件、規則與測試，彼此只透過 `index.ts` 使用。
3. `src/data`、`src/lib`、`src/components`：內容資料、純函式、共用元件，不碰使用者資料。
4. `src/storage`：資料表、存取函式、記憶體替代資料庫、診斷資訊。

`src/app` 放路徑表、版面、導覽、toast 與警示列；`scripts/build` 是建置時才跑的工具，不進網站程式包。
