## 1. 產生器骨架

- [x] 1.1 建立 `scripts/build-app-icon.ts`，`import` 專案既有的 `src/utils/orb-engine.ts` 與 `src/utils/orb-color.ts`，取出 breathing preset 在設計尺寸 64、時刻 0 的那一幀——驗收：以 `node scripts/build-app-icon.ts` 執行可印出 484 個點，且透明度範圍為 0.594～0.806
- [x] 1.2 實作亮度重對應：掃過當幀找出最暗與最亮兩端（今天量到的是 0.44～0.70），把這兩端線性拉開成 0.55～0.95，透明度整體乘 1.3 並以 1 為上限——驗收：印出重對應後的亮度範圍，最低 0.55、最高 0.95
- [x] 1.3 實作繪製：超取樣畫布上先鋪圓角底（超橢圓指數 5，四周留白 9.77%），再依 `frame.dots` 原順序畫點（不排序），最後畫中央的終端機提示符號（佔記號 0.32、24 繪圖框裡筆畫 2.6）——驗收：各項數值與 design.md「版面數值」表逐項對得上
  - 畫點的部分已由 T5 取代為畫刻度線；底與提示符號的畫法不變
- [x] 1.4 以 Node 內建 `zlib` 組出 PNG 並輸出 1024×1024 來源圖——驗收：產出的檔案可在「預覽程式」開啟，尺寸為 1024×1024、含 alpha 通道
- [x] 1.5 在 `package.json` 加一個產生圖示的 script——驗收：`pnpm run <script 名>` 一行產出來源圖

## 2. 產出並安裝圖示

- [x] 2.1 跑產生器產出來源圖，再跑 `tauri icon` 產出全平台尺寸——驗收：`src-tauri/icons/` 下 16 個檔案的修改時間都是本次，開啟 `icon.png` 與 `128x128@2x.png` 確認不再是 Tauri 預設的藍黃兩圈
- [x] 2.2 確認 `src-tauri/tauri.conf.json` 的 `bundle.icon` 清單所列五個路徑都存在且已更新——驗收：逐一檢查 `32x32.png`、`128x128.png`、`128x128@2x.png`、`icon.icns`、`icon.ico`，`tauri.conf.json` 本身不需修改

## 3. 規格文件

- [x] 3.1 更新 `openspec/specs/brand-mark/spec.md` 的 `## Purpose`，讓它涵蓋品牌記號的兩種形態（側欄的動態記號、App 圖示的靜態形態）——驗收：Purpose 讀起來不再只講側欄；此段必須直接改主 spec，delta 裡的 Purpose 會被忽略

## 4. 驗收

- [x] 4.1 跑 `tauri build --debug` 產出 `.app`，在 Finder 與 Dock 檢視——驗收：圖示為品牌記號的環與提示符號，且在 Dock 中與相鄰 App 的圖示視覺大小相當（`pnpm dev:app` 看不到，它跑的是裸執行檔不是 `.app`）
- [x] 4.2 把 `.app` 放到淺色桌布上檢視——驗收：圖示有清楚的深色底，環上的點不透出桌布顏色
- [x] 4.3 在 Finder 由大到小切換圖示尺寸檢視——驗收：各尺寸只有清晰度差異，構圖、比例與配色相同；最小尺寸糊掉是預期結果，不是缺陷
- [x] 4.4 確認側欄記號未受影響——驗收：`git status` 顯示 `src/components/BrandMark.vue`、`src/utils/orb-engine.ts`、`src/utils/orb-color.ts` 皆未改動，`pnpm dev` 開啟後側欄記號照常流動
  - 兩半皆已確認：三個檔對 main 位元組相同；側欄記號開起來照常流動
- [x] 4.5 跑 `pnpm lint`、`pnpm typecheck`、`pnpm test`——驗收：三者皆通過（產生器若觸發 lint 規則，調整產生器本身，不放寬既有規則）
  - 由 gate 覆蓋：lint 乾淨、typecheck 通過（已新增 `scripts/tsconfig.json` 把產生器與其測試納入掃描）、test 20 檔 250 例全過

## 5. 環改畫成刻度線（驗收後追加）

- [x] 5.1 在 `scripts/build-app-icon.ts` 加上刻度線的分組與擬合：把定格幀的點依繞圓心的角度分成 44 桶，對桶內的點擬合主軸，粗細、顏色與透明度沿主軸做線性擬合——驗收：分桶後每桶恰好 11 顆，不足或超出要讓程式停下來報錯，不要靜默畫出殘缺的環
- [x] 5.2 把畫點換成畫刻度線：每條刻度線畫成單一膠囊形（沿主軸投影、粗細沿線內插、兩端圓角），依每條線的平均深度由遠到近繪製——驗收：放大檢視任一條刻度線，邊緣平滑、看不出圓點，也沒有分段接縫
- [x] 5.3 重跑產生器與 `tauri icon`，更新 `src-tauri/icons/` 全部 16 個檔案——驗收：16 個檔案的修改時間都是本次；`icon.icns` 的位元組必然改變，那是 tauri CLI 打包不可重現所致，不代表圖變了（比對方式見 design.md 的 Risks）
- [x] 5.4 確認側欄記號仍未受影響——驗收：`src/components/BrandMark.vue`、`src/utils/orb-engine.ts`、`src/utils/orb-color.ts` 對 `main` 仍是位元組相同
- [x] 5.5 重跑 `pnpm lint`、`pnpm typecheck`、`pnpm test`——驗收：三者皆通過；既有測試驗的是「顏色只落在 surface 與 accent-bright 的連線上」與留白比例，換畫法後這些仍應成立，若轉紅代表擬合把顏色算到了色票範圍外
