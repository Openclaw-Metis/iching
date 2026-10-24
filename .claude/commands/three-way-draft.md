---
description: 三方（Claude、Codex、agy）各自獨立撰稿、比對定稿、交叉複審
argument-hint: <內容種類> <批次範圍> <輸出路徑>
---

# 三方撰稿

參數：$ARGUMENTS

- 內容種類：`lines`（卦辭與爻辭白話，規格「爻辭與卦辭白話內容規格」）或 `content`（牌義，見 docs/content-review.md）。
- 批次範圍：卦序範圍，例如 `1-64` 或 `33-40`；每批 8 卦。
- 輸出路徑：定稿寫入的檔案，例如 `src/data/lines.json`。

先讀 docs/spec.md 對應的內容規格、docs/content-review.md 的「撰寫原則」與誤讀表，以及這類內容既有的審訂文件（lines 為 docs/lines-review.md）。經文一律以 src/data/classic.ts 的 `textOf(n)` 取用：`judgment` 為卦辭，`lines[0]` 到 `lines[5]` 為初到上爻，乾坤的 `lines[6]` 為用九、用六。

## 步驟

1. 列出待辦清單，確認 `codex` 與 `agy` 指令可用；不可用時停下回報，不要假裝三方都寫了。
2. 產生批次檔放在 scratchpad：每批 8 卦，附該卦卦辭、彖傳、大象、六爻與小象全文（乾坤加文言與用九用六），以及撰寫規則、欄位長度與輸出 JSON 結構（lines 為 `{"drafts":[{"key","plain","advice","notes"}]}`，鍵為 `卦序-judgment`、`卦序-爻位`、`1-use`、`2-use`）。
3. 背景平行執行另外兩方，各自只讀自己的批次檔：
   - Codex：`codex exec` 加 `--output-schema <schema.json>` 與 `-o <輸出檔>`。
   - agy：`--mode plan`，提示寫明「只讀檔、不執行任何指令」，避免無頭模式因想執行指令而沒有輸出；沒有輸出時以同樣提示重跑該批。
4. 同時自己寫完整初稿；自己的稿寫完之前不讀另外兩份。
5. 逐卦並列三份比對定稿，每條都要通過：長度檢查；「」引文以 src/lib/text.ts 的 `normalizeQuote` 比對，能在 易經_周易_原文.md 找到且斷句位置一致；沒有破折號；不斷定現況、不保證結果、不給醫療法律投資建議；古代性別、婚姻、刑罰內容點明語境。
6. 定稿連同原文交 Codex 與 agy 逐卦複審（義理、出處、表達、語境轉譯、提醒是否可行），逐條判斷採納與否並記錄理由。
7. 寫入輸出路徑並跑對應測試（lines 為 `npx vitest run src/data/lines.test.ts`）。
8. 三方初稿存 `docs/review/<種類>-round1.json`，複審意見存 `docs/review/<種類>-round2.json`；審訂文件補上方法、誤讀處理表、複審統計與主要修正。
9. 清除 scratchpad 工作檔，回報定稿完成數、測試結果與複審採納統計；不 commit。
