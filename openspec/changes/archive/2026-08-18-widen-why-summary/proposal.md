## Why

卡片摘要留了兩行版位，抽取端卻只給第一句——19 份既有 proposal 實測下來，首句平均只佔 Why 段落的 55%，兩行版位平均只用掉一行。使用者因此在清單層看到的是被句號攔腰切斷的半份理由，而版位明明還空著。

## What Changes

- Why 摘錄的抽取單位自「第一段的首句」擴為「第一段全文」：去除行內 Markdown 記號後整段帶回，不再判定句末位置。
- 移除句末判定的全部邏輯，連帶消滅其已知代價——後接空白的英文縮寫（`See e.g. the second section.`）不再被誤切成 `See e.g.`。
- 摘錄的截斷完全交給呈現層：卡片維持最多兩行，截斷點與省略號由 CSS 自行決定，抽取端不再嘗試預測顯示行數。
- 段落不設字元上限：空行本身即天然邊界（實測最長 251 字元），額外的硬上限只是無人會撞到的魔術數字。
- 清單回應攜帶的摘錄長度因此增加（平均 74 → 143 字元），但讀取範圍不變：仍只讀各 change 目錄下的 `proposal.md`，仍只取 `## Why` 之後的第一段。
- 非 BREAKING：對外欄位、函式簽章與卡片結構皆不變，僅該欄位的內容長度改變。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `openspec-gateway`: 「清單項目的 Why 摘錄」的抽取規則自首句改為第一段全文，句末判定與半形句號保護一併移除；「詳情通道的檔案白名單」中摘錄例外的措辭自「單一句子」改為「該段落」（讀取範圍的三項約束不變）。
- `change-list`: 卡片摘錄的內容定義自「首句」改為「`## Why` 第一段」，兩行上限與省略號截斷的呈現規則不變。

## Impact

- `src/api/why-summary.ts`：刪除 `firstSentence()`，`extractWhy()` 只保留段落收集與 `stripMarkdown()`。
- `src/api/why-summary.test.ts`：句末判定相關的案例移除，改為驗證整段帶回與跨行接合。
- `docs/ui-structure-decisions.md`：卡片規格表的 Why 摘錄列更新——原記的「反向形成寫作紀律」不成立（proposal 由 pipeline 產出，UI 顯示規則回饋不到寫作端），改記「兩行為上限、抽取端不猜行數、截斷交呈現層」。
- 不需改動：`src/components/ChangeCard.vue`（`line-clamp-2` 已在）、`src/api/normalize.ts`、`src/api/normalize-parked.ts`、`src/api/types.ts`（簽章與欄位不變）。
- 呈現面的可觀察變化：摘錄只佔一行的卡片比例由約 50% 降至 5%，skeleton 替換時的版面跳動隨之減少；省略號出現頻率隨視窗寬度上升（行寬 73 格時 16%、50 格時 68%、32 格時 95%），為接受的行為。
