---
description: 對照規格的驗收條件，逐條確認自動測試與手動檢查是否涵蓋並通過
argument-hint: [AC 編號範圍，例如 AC-01..AC-31]
---

# 驗收對照

範圍：$ARGUMENTS（未指定時為 AC-01 到 AC-31）

1. 讀 docs/spec.md 的「驗收條件」「測試案例」「Gherkin / BDD」「Edge / Abuse cases」，以及 docs/qa-checklist.md 目前的對照表。
2. 以 `grep -rn "AC-xx\|TC-xx" src --include=*.test.*` 找出每一條對應的測試；測試名稱或檔頭要標註編號。沒有測試、也沒有手動檢查項的條目列為缺口。
3. 執行 `npm test`、`npm run typecheck`、`npm run build`、`npm run check:size`，記錄結果。
4. 補上缺少的測試（單元、整合用 fake-indexeddb、元件用 happy-dom），每個新測試標註對應的 AC 或 TC 編號；補測試時發現的缺陷以最小改動修正並補對應測試。
5. 以 `npm run preview` 在瀏覽器（Playwright）走 docs/qa-checklist.md 的手動項目：375 與 1280 寬、鍵盤、減少動態效果、離線、CSP、第三方請求、停用 WebGL；`npm run check:routes -- http://localhost:4173` 檢查 102 條路徑。
6. 更新 docs/qa-checklist.md 的對照表與結果欄，未能驗證的項目寫明原因。
7. 回報：對照表、測試數、手動檢查結果、未驗證項目；不 commit。
