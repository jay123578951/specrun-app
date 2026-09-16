## 1. 卡片時間格式

- [x] 1.1 為 `src/utils/time.ts` 新建 `time.test.ts`，以注入的 `now` 覆蓋既有相對寫法的分、時、日、月、年各階；執行 `pnpm test` 通過，確認改動前的輸出被固定下來
- [x] 1.2 在 `formatRelativeTime` 加入「同一本機日曆日」分支，輸出 24 小時制時分（如 `18:38`），非同日維持既有相對寫法；驗證 1.1 的既有案例全數不變
- [x] 1.3 補測試：同日時刻輸出時分、跨日回到相對、午夜前後各一次的分界行為（同一個 epoch 在午夜前輸出時分、午夜後輸出相對）；`pnpm test` 通過
- [x] 1.4 （由操作流程驗證 gate 覆蓋）啟動 App 目視確認：Active 群組今天動過的卡片顯示時刻、兩日前的卡片顯示 `2d ago`；Parked 群組今天停放的顯示 `parked 14:22`、三週前的顯示 `parked 3w ago`；`ChangeCard.vue` 未被修改（`git diff --stat` 不含該檔）

## 2. 建立時刻的取得

- [x] 2.1 在 `src/api/types.ts` 為 `ChangeSummary` 與 `ParkedSummary` 各加一個可為 `null` 的建立時刻欄位（epoch ms），並更新對應型別註解；`pnpm typecheck` 通過
- [x] 2.2 在 `server/api/parked.get.ts` 逐筆讀檔那一輪併行取得 change 目錄的 `birthtimeMs`，`0` 或取值失敗回傳空值；單筆失敗不影響其餘項目與整份清單
- [x] 2.3 在 `server/api/changes.get.ts` 以同樣方式為 active 清單補上建立時刻，與既有的 proposal 直讀併行發出，不新增任何 CLI 呼叫
- [x] 2.4 在 `src/api/normalize.ts` 與 `src/api/normalize-parked.ts` 把新欄位轉成 epoch ms 或 `null`；補測試涵蓋「取得成功」與「取不到回 `null`」兩路，`pnpm test` 通過
- [x] 2.5 驗證 park 不改寫建立時刻：對某 change 記下建立時刻，park 之後再讀 parked 清單，兩次數值相同；確認 `.git/specrun-app/parked.json` 內容未新增欄位

## 3. 詳情面板顯示建立時刻

- [x] 3.1 在 `ArtifactPanel.vue` 的 `#actions` 槽最前端加入建立時刻元素，文案 `Created <MM-DD HH:MM>`（24 小時制、不含年份），`title` 給含年份的完整值
- [x] 3.2 套上非互動呈現：對比明顯低於同列 icon 按鈕、無 hover／press 外觀變化、不可聚焦、無邊框與按鈕底色；與動作按鈕群組的間距大於按鈕彼此的間距
- [x] 3.3 在 `PanelShell.vue` 的動作槽放寬「只裝 icon 按鈕」的假設（間距處理），並確認 `ArchivedPanel.vue` 的 header 排版仍與 `ArtifactPanel.vue` 同構；歸檔面板不加此欄位
- [x] 3.4 建立時刻為 `null` 時整個元素不渲染、不留佔位、不顯示任何提示；以暫時改回 `null` 的方式實測一次，確認面板 header 無空隙
- [x] 3.5 （由操作流程驗證 gate 覆蓋）目視驗收：點開 active change 與 parked change 各一，兩者皆在複製名稱鈕左側顯示 `Created 09-15 16:38`；滑鼠停留出現含年份的完整值；鍵盤 Tab 不會停在該欄位；歸檔頁面板不顯示此欄位

## 4. 收尾

- [x] 4.1 `pnpm lint`、`pnpm typecheck`、`pnpm test` 全數通過
- [x] 4.2 （由 Reviewer 與操作流程驗證 gate 覆蓋）確認排序未被改動：Active 仍依最後修改新→舊、Parked 仍依 park 時點新→舊、新 park 的卡片仍插在 Parked 最上面
- [x] 4.3 （由 Reviewer gate 覆蓋）確認未引入被排除的項目：無群組內拖曳排序、無 change 之間的依賴記錄、卡片未顯示建立時刻
