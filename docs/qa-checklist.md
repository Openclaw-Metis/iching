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
| AC-23 | `src/app/buildScripts.test.ts`（TC-19，建置產物） | `node scripts/check-routes.mjs`：本機 preview 102 條全過；**正式站要合併到 main 部署後再跑** |
| AC-24 | `npm run check:size`（CI） | |
| AC-25 | | 加到主畫面與離線（見下方） |
| AC-26 | | 375 寬各頁（見下方） |
| AC-27 | | CSP 與第三方請求（見下方） |
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
| 正式站路徑 | 合併到 main 部署後 `node scripts/check-routes.mjs` | **尚未驗證**（分支尚未部署） |

## 部署後要做的事

1. `node scripts/check-routes.mjs`：102 條路徑都要直接回 200 且標題正確。
2. 用 Chrome 開正式站，確認網址列出現安裝圖示；用 iPhone 的 Safari 加入主畫面後離線開啟一次。
3. 下載 `.ics` 在 Google 日曆與 Apple 行事曆各匯入一次，確認每天提醒並附網站連結。
