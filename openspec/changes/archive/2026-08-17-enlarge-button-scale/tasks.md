## 0. 前置

- [x] 0.1 確認工作區既有的未提交改動（選單加大：`uno.config.ts` 的 `side-item`／`side-action`／`project-item` 改 `py-2`、`AppSidebar.vue` 的 `space-y-1`、`ProjectSwitcher.vue` 的資料夾 icon 與移除入口迭代）已單獨 commit 或已與使用者確認保留。本 change 全程**不觸碰** `ProjectSwitcher.vue` 的移除入口（絕對定位的小按鈕）與那三個選單 shortcut。

## 1. shortcut 定義（`uno.config.ts`）

- [x] 1.1 `btn-quiet` 改名為 `btn` 並改值：`h-9` → `h-11`、`px-3` → `px-4`、`gap-1.5` → `gap-2`、`text-ui-sm` → `text-ui-base`。其餘一律原封不動（`inline-flex items-center rounded border border-line text-text-2`、`transition-[background-color,color,transform] duration-150 ease-[var(--sr-ease-out)]`、`hover:bg-surface-hover hover:text-text`、`active:scale-[0.96]`、`disabled:*`、`kbd-focus`）。
- [x] 1.2 `btn-quiet-sm` 改名為 `btn-sm` 並改值：`h-8` → `h-9`、`px-2.5` → `px-3`。字級維持 `text-ui-sm`，`justify-center` 保留（兩個呼叫端都是 `flex-1` 並排）。
- [x] 1.3 改寫 `btn-sm` 的註解：刪除「`h-8` 與 `input-quiet` 同高，成排時不會高低不齊」（`input-quiet` 已無任何呼叫端，該關係不存在），改述為「窄脈絡專用：服務側欄 224px 的就地確認列」。
- [x] 1.4 `btn-danger` 剝離盒子、只留色調，定案寫法為 `'!border-error/50 !text-error hover:!bg-error/15 active:!bg-error/25'`。**important 前綴不可省**（理由見 design.md - D3：與 `btn-sm` 的 `border-line`／`text-text-2` 來自同一條規則，不加 important 時勝負由 CSS 產生順序決定且不會報錯）。註解保留原本「error 色只在邊框與文字，底色留給 hover」的說明，並補一句用法 `class="btn-sm btn-danger"`。
- [x] 1.5 `icon-btn` 改值：`h-7 w-7` → `h-8 w-8`、`before:-inset-2` → `before:-inset-[8px]`。註解的「視覺 28px、實際點擊面積外擴到 44px」現在成立，確認數字與新值一致（28 ＋ 8×2 ＝ 44）。
- [x] 1.6 `tab-item` 改值：`h-10` → `h-12`。改寫註解，把「40px 高是密集工具介面的點擊面積下限」改為 42px 的真值敘述，並註明根字級 14px 下 `h-12` ＝ 42px。
- [x] 1.7 在 shortcuts 區塊上方（或 `btn` 定義處）補一段註解，說明按鈕是兩階（`btn` 主階／`btn-sm` 窄脈絡）＋ `icon-btn` 自成一路，色調由 `btn-danger` 正交覆蓋；並註明點擊面積外擴刻意用釘死的 px 而非 rem 級距（理由見 design.md - D4）。
- [x] 1.8 確認 `pnpm build` 或 dev server 啟動無 UnoCSS 解析錯誤。此時畫面仍有大量失效的舊 class（裸 `<button>`），屬預期中間態，不在此步驟驗畫面。

## 2. 主階 `btn` 呼叫端（10 處，6 檔）

改名 `btn-quiet` → `btn`，並把按鈕內的圖示 `h-3.5 w-3.5` → `h-4 w-4`。

- [x] 2.1 `ChangeList.vue`：header Refresh（74 行 class、80 行圖示）、空狀態 Add project（95 行 class、96 行圖示）、錯誤態 Try again（121 行，無圖示）。三處 `btn-quiet` → `btn`，兩處圖示升級。
- [x] 2.2 `SpecsView.vue`：header Refresh（74、80 行）、Add project（95、96 行）、Try again（132 行）。同 2.1 處理。
- [x] 2.3 `ArchivedView.vue`：header Refresh（58、64 行）、Add project（79、80 行）、Try again（116 行）。同 2.1 處理。
- [x] 2.4 `SpecPanel.vue:65`、`ArtifactPanel.vue:130`、`ArchivedPanel.vue:106` 三處 Try again：`btn-quiet` → `btn`（皆無圖示）。
- [x] 2.5 三個 header Refresh 按鈕額外掛的 `before:-inset-y-1` 外擴保留不動：主階已長到 38.5px，外擴後點擊高度約 45.5px，符合 WCAG 2.5.5。

## 3. `icon-btn` 呼叫端圖示（5 處，5 檔）

shortcut 名稱不變，只需把圖示 `h-3.5 w-3.5` → `h-4 w-4`。

- [x] 3.1 `PanelShell.vue:45` 收合箭頭。
- [x] 3.2 `ArtifactPanel.vue:54`、`SpecPanel.vue:33`、`ArchivedPanel.vue:44` 三處 Refresh 圖示。
- [x] 3.3 `ChangeCard.vue:128` park／unpark／loading 圖示（`:class` 綁定的三個圖示共用同一個 `h-3.5 w-3.5` 容器）。
- [x] 3.4 更新 `PanelShell.vue:34` 的註解：「標題放大後與 24.5px 的 icon-btn 並排會比例打架」→ 改為 28px。該行的設計理由（按鈕收在上方兩端、標題獨佔下一列）不變。

## 4. 側欄就地確認列（`ProjectSwitcher.vue`）

- [x] 4.1 第 86 行 Cancel：`btn-quiet-sm flex-1` → `btn-sm flex-1`。
- [x] 4.2 第 83 行 Remove：`btn-danger flex-1` → `btn-sm btn-danger flex-1`。
- [x] 4.3 目視確認確認列：兩顆按鈕等寬、同高 31.5px，`Remove`／`Cancel` 文案未被截斷，紅色只落在 Remove 的邊框與文字上、Cancel 維持中性。**特別確認 Remove 真的是紅的** —— 若呈灰色，代表 1.4 的 important 前綴漏了。
- [x] 4.4 確認本檔的移除入口（絕對定位的 ✕ 按鈕）與資料夾 icon 完全未被改動。

## 5. tabs 高度與頭部留白

- [x] 5.1 `ArtifactPanel.vue:64` 的 `pb-1.5 pt-4.5`：`h-12` 後 tabs 自帶的上方空白自 7.1px 增至 10.6px，`pb` 需自 5.25px 降至約 1.75px 才維持原本 12.35px 的視覺距離。改為 `pb-0.5`（3.5px → 14.1px）或 `pb-[2px]`，**以目視「標題→按鈕」與「標題→tabs」等距為準**，不死守算式。`pt-4.5` 不動。
- [x] 5.2 `ArchivedPanel.vue:52` 同構處理，且**必須與 5.1 同值**。
- [x] 5.3 更新兩處註解裡的推算說明，把 `h-10`／7.5px 的數字換成新值。
- [x] 5.4 目視確認 artifact 詳情面板與 archived 詳情面板：tabs 列變高後底線仍貼齊 header 下緣（`-mb-px` 生效）、首個 tab 的 `first:pl-0` 仍與標題左緣對齊、選中態底線位置正確。
- [x] 5.5 沒有 tabs（載入中／失敗）時的撐高元素必須同步改值：`ArtifactPanel.vue:111` 與 `ArchivedPanel.vue:87` 的 `<div v-else class="h-10">` 一併改為 `h-12`。漏改會讓頭部在載入完成的瞬間先塌 7px 再彈回來。
- [x] 5.6 目視確認上述兩處：面板從載入中切到有內容時，tabs 那一列的高度完全不跳動。

## 6. toast 關閉鈕（`ToastStack.vue`）

- [x] 6.1 第 42 行的關閉鈕：`p-1` 改為 `relative h-7 w-7 flex items-center justify-center`，並加上 `before:absolute before:-inset-[10px] before:content-['']` 把點擊面積外擴到約 44px。既有的 `kbd-focus ml-auto shrink-0 rounded text-text-3 transition-colors duration-150 hover:text-text` 保留。
- [x] 6.2 第 46 行圖示：`h-3.5 w-3.5` → `h-4 w-4`。
- [x] 6.3 補一句註解說明：視覺刻意比 `icon-btn` 小一階且無邊框（浮層上的次要動作），但點擊面積補到與 `icon-btn` 同級；toast 卡片本體不可點，外擴不會偷走任何點擊。
- [x] 6.4 目視確認 toast：關閉鈕與標題文字的頂部對齊仍成立（原本靠 `mt-0.5` 微調的是左側 icon，關閉鈕變高後需確認整列不歪），多則 toast 堆疊時間距正常。

## 7. 收斂檢查

- [x] 7.1 `grep -rn 'btn-quiet' src` 結果必須為空。UnoCSS 的 shortcut 改名後，殘留舊名不會報錯、只會靜默失去全部樣式（變成裸 `<button>`），所以這一步是硬性收斂條件而非目視。
- [x] 7.2 `grep -rn 'h-3.5 w-3.5' src` 檢查殘留：預期只剩 `ProjectSwitcher.vue` 移除入口的 ✕ 一處（本輪刻意不碰）。其餘 12 處應全部已升為 `h-4 w-4`。
- [x] 7.3 `grep -rn 'h-3 w-3' src` 確認 chip／徽章的圖示**未**被誤改（`ArtifactPanel` 的 Parked·read-only 與 Not refreshed、`ArchivedPanel` 的 Archived·read-only）—— 那些不是按鈕。
- [x] 7.4 `grep -rn 'input-quiet' src` 應為空（確認 1.3 只改了註解、沒有連帶刪除 shortcut 定義本身）。
- [x] 7.5 `git diff --stat` 確認 `src/styles/markdown.css` **未被改動**。Markdown 的 task checkbox（13px）是刻意留給下一輪的，不要順手放大（理由見 design.md - D7）。同時確認 `ProjectSwitcher.vue` 的 diff 只落在 83／86 兩行的 class 上。

## 8. 驗收與文件

- [x] 8.1 逐頁目視驗收：Changes（header Refresh／空狀態 Add project／錯誤態 Try again／卡片 park 按鈕的 hover 浮現）、Specs、Archived 三頁同樣三種按鈕、詳情滑出面板（收合鈕、Refresh、各 tab）、側欄確認列、toast。
- [x] 8.2 確認三頁 header 的主從關係沒有翻轉：11px eyebrow 標題與 38.5px Refresh 並排時，標題仍是該列的主角。若翻轉，退路是主階降到 `h-10` 35px（見 design.md - D2），**不要**改動 header 結構。
- [x] 8.3 確認 `ChangeCard` 的 park 按鈕：`icon-btn` 升至 28px 後應正好填滿標題列的 `h-7`（28px）容器，與標題垂直齊平；hover 浮現／常駐（pending）／`aria-disabled` 三種態的透明度切換不受影響。
- [x] 8.4 鍵盤走一遍：Tab 逐一停在所有按鈕上，`kbd-focus` 的 2px accent ring 在新尺寸下完整可見不被裁切（特別是 `icon-btn` 與 toast 關閉鈕，它們的 `::before` 外擴與 `outline-offset-2` 同時存在）。
- [x] 8.5 確認八態未退化：hover、active（`btn` 的 `scale-[0.96]`、`btn-sm`／`icon-btn` 的底色變化）、disabled（`opacity-55` ＋ `cursor-not-allowed`）、loading（Refresh 的 `animate-spin` ＋ `aria-busy`）在新尺寸下全部正常。
- [x] 8.6 執行 `pnpm test` 與 lint，確認無回歸（本 change 無行為變更，測試應全數通過）。
- [x] 8.7 更新 `docs/ui-structure-decisions.md`：新增按鈕尺寸階定稿表（`btn` 38.5／`btn-sm` 31.5／`icon-btn` 28 視覺・44 點擊／`tab-item` 42，全為 14px 根字級下的實際值），記錄「點擊面積用釘死 px、不用 rem 級距」的規則與理由，並註明專案列移除入口刻意維持小尺寸的取捨。
