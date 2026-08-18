## 1. 抽取端

- [x] 1.1 `src/api/why-summary.ts`：刪除 `firstSentence()` 及其註解，`extractWhy()` 的回傳改為 `stripMarkdown(paragraph.join(' '))`
- [x] 1.2 更新 `extractWhy()` 與檔頭的 doc comment：說明抽取單位為第一段全文、截斷由呈現層負責、抽取端不預測顯示行數

## 2. 測試

- [x] 2.1 `src/api/why-summary.test.ts`：移除句末判定相關案例（「只取第一段第一句」、「英文句號同樣算句末」、「半形句號不接空白時不算句末」、「後接空白的英文縮寫仍會被視為句末」、「段落無句末標點時回傳整段全文」）
- [x] 2.2 新增案例：多句段落整段帶回、`See e.g. the second section. Rest.` 完整保留、`design.md` 與後續句子完整保留
- [x] 2.3 保留並確認仍通過：只取第一段（空行斷段）、跨行以單一空白接合、去行內 markdown、無 Why 段落回空字串、段落為空回空字串、任意層級標題與大小寫
- [x] 2.4 執行 `pnpm test` 確認 `why-summary`、`normalize`、`normalize-parked`、`web-gateway` 相關測試全數通過

## 3. 文件

- [x] 3.1 `docs/ui-structure-decisions.md`：更新卡片規格表的「Why 摘錄」列——內容定義改為 `## Why` 第一段，理由改記「兩行為上限而非目標、抽取端不猜行數、截斷與省略號交呈現層」，移除「反向形成寫作紀律」

## 4. 驗證

- [x] 4.1 啟動 App 確認 active 與 parked 卡片的摘錄皆為整段、兩側逐字相同
- [x] 4.2 拉寬與縮窄視窗，確認截斷點隨寬度調整、省略號僅於溢出時出現、未滿兩行時不補白
- [x] 4.3 確認摘錄缺件情形（無 proposal、無 `## Why`）仍不顯示摘錄區塊、不報錯
