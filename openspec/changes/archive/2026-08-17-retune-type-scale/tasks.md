## 1. 字級表與 shortcuts

- [x] 1.1 改寫 `uno.config.ts` 的 `text` 表為 UI 五階：`ui-xs` 11、`ui-sm` 13、`ui-base` 15（lh 1.6）、`ui-title` 17、`ui-lg` 21；刪除 `mono-lg`／`mono-base`／`mono-sm` 與 `read-base`／`read-h1`／`read-h2`／`read-h3`／`read-code` 共八個舊階。`configResolved` 的封閉集合覆寫不動。
- [x] 1.2 改寫 `text` 表上方的註解：十階改為五階、說明 mono 與 sans 共用數值（字體由 `font-mono` 表達）、說明閱讀階梯已移出本檔改由 `src/styles/markdown.css` 承載。
- [x] 1.3 把 `input-quiet` shortcut 的 `text-mono-sm` 改為 `text-ui-sm`（11.5px → 13px）。其餘 shortcut（`btn-quiet`、`btn-quiet-sm`、`btn-danger`、`tab-item` 用 `ui-sm`；`side-item`、`side-action` 用 `ui-base`）token 名不變，值隨表更新。
- [x] 1.4 確認 `pnpm build` 或 dev server 啟動無 UnoCSS 解析錯誤（此時畫面仍有殘留舊 class，屬預期中間態）。

## 2. 元件字級重新指派

- [x] 2.1 `AppSidebar.vue:14` wordmark：`text-read-h1` → `text-ui-lg`（脫離閱讀階梯）。
- [x] 2.2 `ChangeCard.vue`：標題 `h3`（80-83 行）改掛 `text-ui-title`；n/m 數字（88 行）`text-mono-sm` → `text-ui-sm`；容器（80 行）移除 `text-mono-base`。時間（99 行）與 No tasks（94 行）維持 `text-ui-sm` 不動。
- [x] 2.3 `ChangeList.vue:59` 路徑：`text-mono-sm` → `text-ui-sm`。群組標題（68、143 行）維持 `text-ui-xs`。
- [x] 2.4 `SpecsView.vue`：實列 spec id（155 行）`text-mono-base` → `text-ui-title`；路徑（59 行）`text-mono-sm` → `text-ui-sm`；skeleton 容器（109 行）移除 `text-mono-base`。
- [x] 2.5 `ArchivedView.vue`：實列項目名（140 行）`text-mono-base` → `text-ui-title`；n/m（150 行）`text-mono-sm` → `text-ui-sm`；skeleton 容器（93 行）移除 `text-mono-base`。
- [x] 2.6 `ArtifactPanel.vue`：面板標題（66 行）`text-mono-lg` → `text-ui-lg`；路徑（159 行）`text-mono-sm` → `text-ui-sm`。
- [x] 2.7 `SpecPanel.vue:43` 與 `ArchivedPanel.vue:53` 面板標題：`text-mono-lg` → `text-ui-lg`。
- [x] 2.8 `ProjectSwitcher.vue`：專案名（113 行）`text-mono-base` → `text-ui-base`；徽章數字（124 行）`text-mono-sm` → `text-ui-xs`。
- [x] 2.9 `StateNotice.vue:28` detail 路徑與 `ToastStack.vue:36` detail：`text-mono-sm` → `text-ui-sm`。
- [x] 2.10 全域搜尋 `text-mono-` 與 `text-read-` 確認 `src/` 已無殘留引用（`grep -rn 'text-mono-\|text-read-' src`），結果應為空。

## 3. 列高常數統一

- [x] 3.1 把七處 `h-[1.6em]` 全部改為 `h-7`：`ChangeCard.vue:80`、`ChangeCardSkeleton.vue:4`、`SpecsView.vue:109,155`、`ArchivedView.vue:93,140,146`。七處必須同值。
- [x] 3.2 `ChangeCardSkeleton.vue:4` 一併移除 `text-mono-base`（高度已由 `h-7` 決定，不再依賴容器字級）。
- [x] 3.3 目視確認：Changes 頁載入中的 skeleton 卡片與載入完成的實卡高度一致，切換瞬間版面不跳動；Specs 與 Archived 兩頁同樣確認。
- [x] 3.4 目視確認 `ArchivedView` 實列的標題與右側數字群垂直對齊（146 行容器內只有數字，是最容易錯位的一處）。

## 4. 閱讀階梯

- [x] 4.1 改寫 `src/styles/markdown.css` 字級：`.md-body` 15px/1.85 → **16px/1.8**；`h1` 20 → **22**；`h2` 18 → **19**；`h3` 15.5 → **16**；`h4` 15 → **16**（維持 `text-2` 色階）；`code` 13 → **14**；`pre` 13 → **14**；`table` 維持 **14**。
- [x] 4.2 改寫 `markdown.css` 頂部註解：刪除「字級走 read-* 階」的錯誤陳述，改為「閱讀字級的定義處即本檔，UI 階梯在 `uno.config.ts`，兩者刻意不共用」，並列出四階全表（14／16／19／22）。
- [x] 4.3 目視確認詳情面板各 artifact tab 的 Markdown 渲染：正文、`##`／`###` 標題層級、inline code、程式碼區塊、表格、task list checkbox 與文字的基線對齊。

## 5. 驗收與文件

- [x] 5.1 逐頁目視驗收：Changes（Active／Parked 兩群組、skeleton 態、空狀態、blocking error）、詳情滑出面板（各 tab）、Specs、Archived、側欄（專案清單／Add project 展開態／wordmark／Specs·Archive 入口）、toast。
- [x] 5.2 確認側欄未因 `ui-base` 升階（列高 34.4px → 36px）出現非預期捲動或擁擠；確認長專案名截斷正常不溢出。
- [x] 5.3 確認 `btn-quiet`（h-9）、`btn-quiet-sm`／`btn-danger`／`input-quiet`（h-8）在新字級下垂直居中與左右內距仍平衡。
- [x] 5.4 執行 `pnpm test` 與 lint，確認無回歸（本 change 無行為變更，測試應全數通過）。
- [x] 5.5 改寫 `docs/ui-structure-decisions.md` 的「字級」定稿表（原 156-174 行）為新的 UI 五階表；記錄「mono 與終端 14px 對齊」約束已由使用者解除的理由；記錄閱讀階梯改由 `markdown.css` 單獨承載、`read-*` token 已廢除。
