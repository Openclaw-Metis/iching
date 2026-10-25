# 驗收對照與手動檢查表

規格 `docs/spec.md`「驗收條件」AC-01 至 AC-31 的對應測試與手動檢查。自動測試以 `npm test` 執行（node 環境跑單元與整合測試、`*.test.tsx` 用 happy-dom）；手動檢查以 `npm run build && npm run preview` 後在瀏覽器進行，下方記錄 2026-10-24 在雲端環境以 Playwright（Chromium）實際走過的結果。

## AC 對照表

| 編號 | 自動測試 | 手動或瀏覽器檢查 |
|---|---|---|
| AC-01 | `src/features/divination/engine.test.ts`（三錢 200,000 爻） | |
| AC-02 | `engine.test.ts`（大衍一鍵 200,000 爻） | |
| AC-03 | `engine.test.ts`（`yarrowChange` 邊界與窮舉） | |
| AC-04 | `engine.test.ts`（手動輸入 0 到 3 枚正面） | |
| AC-05 | `src/data/lines.test.ts`、`src/features/divination/buildReading.test.ts`（4,096 組） | |
| AC-06 | `src/features/divination/DivineFlow.test.tsx`（起卦中斷後接續） | 占卜頁擲 3 爻後重新整理 |
| AC-07 | `src/storage/repos/readings.test.ts`（重跑不建第二筆）、`DivineFlow.test.tsx`（存入紀錄） | 六爻完成後 1 秒內出現「已存入紀錄」 |
| AC-08 | `readings.test.ts`（`hasExactQuestionSince`）、`DivineFlow.test.tsx`（提醒對話框） | |
| AC-09 | `DivineFlow.test.tsx`（完成時保存失敗）、`src/features/backup/backup.test.ts`、`ImportPreviewDialog.test.tsx`（部分備份停用取代） | 攔截 IndexedDB 寫入後下載單筆檔並匯入 |
| AC-10 | `src/features/records/records.test.ts` | 我的頁刪除後按復原；10 秒後清除 |
| AC-11 | `src/features/daily/daily.test.ts`（含 Gherkin「今日卦當天固定」） | 兩個分頁同時翻開、模擬隔天回到牌背 |
| AC-12 | `src/features/daily/ics.test.ts`（含 TC-11） | 以 Mozilla ical.js 解析並展開每天的事件；**尚未**在 Google 日曆與 Apple 行事曆實際匯入 |
| AC-13 | `src/data/lines.test.ts` | |
| AC-14 | `src/features/academy/grading.test.ts`（8 分通過、7 分不通過、Gherkin「考核通過」）、`LessonPlayer.test.tsx`（送出前不揭露） | 以 1280 寬從頭完成 8 站 24 課 8 場考核 |
| AC-15 | `src/storage/repos/xp.test.ts`（含 TC-09）、`src/features/academy/attempts.test.ts`（10 秒防刷） | |
| AC-16 | `src/features/academy/streak.test.ts`（含 TC-07）、`xp.test.ts` | |
| AC-17 | `src/features/review/review.test.ts` | 看圖猜卦答對後卡片到期時間晚於現在 |
| AC-18 | `review.test.ts`（單面向與雙面向） | 卦殿學習地圖：時間調後 12 天變 0.55 與待溫小點 |
| AC-19 | `src/features/academy/seals.test.ts` | 補發的印章出現在印譜分頁 |
| AC-20 | `backup.test.ts`（往返、約 20 MB、1 MB 分卷、Gherkin「匯入前預覽」） | 匯出後在全新的瀏覽器空間合併與取代匯入 |
| AC-21 | `backup.test.ts`、`src/features/backup/validate.test.ts` | 非備份檔提示 |
| AC-22 | `src/storage/open.test.ts`（TC-22） | 停用 IndexedDB 後橫幅出現、占卜仍可完成 |
| AC-23 | `src/app/buildScripts.test.ts`（TC-19，建置產物） | 本機 preview 以 `node scripts/check-routes.mjs` 102 條全過；正式站 102 條全過（見下方「正式站驗收」） |
| AC-24 | `npm run check:size`（CI） | |
| AC-25 | | 加到主畫面與離線（見下方） |
| AC-26 | | 375 寬各頁（見下方） |
| AC-27 | | CSP 與第三方請求（見下方「手動檢查」與「正式站驗收」） |
| AC-28 | `open.test.ts`（TC-21） | 另一分頁把資料庫升到較新版本後的提示 |
| AC-29 | `readings.test.ts`（TC-13） | 兩個分頁同時寫筆記，其中一個收到衝突提示 |
| AC-30 | `attempts.test.ts`（TC-23） | 第 3 題重新整理回到同題同選項同選擇 |
| AC-31 | `src/features/academy/reconcile.test.ts`（含 TC-24）、`backup.test.ts`（匯入後補發） | 啟動後自動補發印章 |

測試案例 TC-01 到 TC-26 中，TC-20 為手動，其餘都在上表的測試檔中，測試名稱標有編號。

## 手動檢查

| 項目 | 方法 | 2026-10-24 結果 |
|---|---|---|
| 375 與 1280 寬沒有橫向捲動 | 卦殿、卡牌頁、今日、占卜、學堂、課程、考核、溫故、我的、404 逐頁量 `scrollWidth - innerWidth` | 兩種寬度 10 頁都是 0 |
| 主要操作不用捲動就能按到（AC-26） | 同上，量主操作按鈕是否在視窗內；課程頁作答時「檢查」在視窗內 | 全部在視窗內；375 寬課程題目與看圖題的「檢查」都不用捲動 |
| 鍵盤操作 | Tab 到今日卦牌按 Enter 翻開；課程用 Enter 前進、方向鍵選答案、Enter 檢查；親手分蓍左右鍵與 Enter | 都可完成 |
| 減少動態效果 | `prefers-reduced-motion: reduce` 下逐頁開啟、翻今日卦 | 正常，沒有長動畫 |
| 離線（AC-25） | preview 註冊 service worker 後關閉網路，開卦殿、今日、占卜、學堂、我的；完成三錢法占卜；看圖猜卦作答 | 全部可用；看過的卡牌仍是全息卡，沒看過的改平面卡圖；白話離線可讀 |
| 正式建置的 CSP（AC-27） | 主控台是否有 CSP 違規 | 沒有 |
| 第三方請求（AC-27） | 記錄所有非本站的請求網域 | 只有 fonts.googleapis.com 與 fonts.gstatic.com |
| 停用 WebGL | `--disable-webgl` 開卡牌頁與今日頁 | 顯示 5:7 平面卡圖並註明；今日卦可翻開 |
| 新版本提示 | 改動 sw.js 後重新檢查更新 | 出現「網站有新版本」，按重新整理後換版 |
| Chrome 可安裝 | CDP `Page.getInstallabilityErrors` | 沒有錯誤 |
| Safari、iOS | iPhone 實機 | **尚未驗證**（雲端環境只有 Chromium） |
| Firefox 匯入 | Firefox 實機 | **尚未驗證** |
| 手機陀螺儀與低階手機效能 | 實機 | **尚未驗證** |
| .ics 匯入 | Google 日曆、Apple 行事曆 | **尚未驗證**（僅以 ical.js 解析） |
| 正式站路徑 | 見下方「正式站驗收」 | 102 條全過 |

## 正式站驗收（2026-10-24，`2d24456` 部署後）

雲端開發環境的網路政策擋下 github.io 與 Actions 產物的下載網址，所以 `check-routes.mjs` 不能直接從這裡跑，改用下列方式：

| 項目 | 方法 | 結果 |
|---|---|---|
| 部署 | GitHub Actions「部署到 GitHub Pages」run 9 | 測試、建置、首屏體積檢查、部署都成功 |
| AC-23 路徑 | Firecrawl 從外部逐一抓取 `routes.ts` 的 102 個正式網址，比對狀態碼、最終網址（有沒有轉址）與標題 | 102 條都直接回 200、沒有轉址、標題正確；不在路徑表的網址回 404 並顯示「找不到這一頁」 |
| 正式站與本機建置相同 | 以部署時相同的 `VITE_SITE_ORIGIN` 在本機建置，比對正式站 `sw.js` 預先快取清單的修訂碼與檔名 | `index.html` 修訂碼相同（`4755da97…`），32 個帶雜湊的程式與樣式檔、`manifest.webmanifest` 全部相同 |
| AC-27 CSP 與第三方請求 | 在上述相同的建置上以 Playwright 逐頁開啟卦殿、乾與屯卡牌頁、今日、占卜、學堂、第一課、第一站考核、溫故、我的，監聽 `securitypolicyviolation` 與所有請求 | 每頁都有 CSP 標籤、沒有違規、沒有主控台錯誤；非本站請求只有 fonts.googleapis.com 與 fonts.gstatic.com（Firecrawl 的瀏覽器抓取時會移除 CSP 標籤，所以改以修訂碼確認正式站 HTML 與本機相同） |
| 主要流程抽查 | 相同的建置，375 與 1280 寬：三錢法占卜存入紀錄、翻開今日卦、開第一課、我的頁看到紀錄、匯出後在全新的瀏覽器空間合併匯入 | 都完成，沒有橫向捲動與主控台錯誤 |

## 部署後要做的事

1. `node scripts/check-routes.mjs`：102 條路徑都要直接回 200 且標題正確（2026-10-24 已以 Firecrawl 完成，網路可直連 github.io 的環境可直接跑這支腳本）。
2. 用 Chrome 開正式站，確認網址列出現安裝圖示；用 iPhone 的 Safari 加入主畫面後離線開啟一次。
3. 下載 `.ics` 在 Google 日曆與 Apple 行事曆各匯入一次，確認每天提醒並附網站連結。

## 2026-10-25 四項穩定性修正

新增回歸：backup.test.ts 的 3 組取代版本號案例、academy/attempts.test.ts 的 4 個跨日入口、LessonPlayer.test.tsx 的 3 個保存與重新開始情境、texturePool.test.ts 的 4 個貼圖生命週期案例。合計新增 14 項，完整測試為 40 檔、276 項通過。

本機正式建置與 Chrome preview 已確認：

- 1280px 與 375px 的六個主要頁面無頁面橫向溢出；三錢完成保存、今日翻牌正常。
- 兩分頁開同筆紀錄，一邊有尚未自動保存的輸入，另一邊取代匯入同 id、同 rev 的備份；舊寫入收到 WRITE_CONFLICT，還原內容與未保存輸入都保留。
- 考核選答後未按下一題就重整，回到同一題且選擇保留；保存失敗的重試另有元件測試。
- 考核開著跨午夜，下一次操作回報 EXAM_EXPIRED，舊作答為 void、不寫成績；按重新開始可建立新作答。
- 連續切換 20 卦，WebGL texture 建立 141、釋放 128，穩定存留數為 13；快速換牌後離開無錯誤。
- 全新瀏覽器空間完成預快取後，離線開未看過的第 64 卦，正常顯示平面卡圖。
- 一般流程無主控台錯誤或警告；離線缺貼圖的降級提示為預期行為。
- 102 條路徑回 200 且標題正確；首屏 JS gzip 130.5 KB，占卜頁 113.2 KB。

本次沒有發布或部署；上述結果來自本機建置。Safari、Firefox 與實機安裝等原有待驗證項目仍保留。