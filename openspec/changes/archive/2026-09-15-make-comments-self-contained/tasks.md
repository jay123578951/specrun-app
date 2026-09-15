> 行號會隨著前面的改寫而位移。每一條都用**引號裡的原文**當定位依據，不要靠行號找。

## 1. 準備與成員判定

- [x] 1.1 確認 `src/components/BrandMark.vue`、`src/utils/orb-color.ts`、`src/utils/orb-engine.ts` 沒有未提交的改動（`git status --short` 這三個檔不出現在清單裡），避免與進行中的 `add-orb-logo` 互相覆蓋；有改動就先停下來問人
- [x] 1.2 用機械特徵掃出丙類全部成員——`grep -rnoE "(design D[0-9–、／/]+|spec [a-z-]{4,})( 的|：|\s+實測|\s+定案)" src/`，再人工補上同型變體（已知：`orb-color.ts`「design D3 打樣結論」、`interactions.css`「design D3 v3」）。驗證：掃描結果至少含下列 17 處，且每一處都確認過「抽掉引用句子就不成立」——`settings.ts` 兩處、`detail.ts` 兩處、`changes.ts`、`render.ts` 兩處、`BrandMark.vue` 三處、`MarkdownView.vue`、`PanelShell.vue`、`types.ts` 兩處、`orb-color.test.ts` 兩處、`view.ts`
- [x] 1.3 逐條讀完 13 處乙類候選的**完整註解區塊**（含它上面幾行），依 design.md D5 的判準逐條記下判定：理由不在註解裡＝乙類要改，理由已寫在上面幾行＝甲類留給第二批。候選為 `BrandMark.vue`「MUST NOT 用 hasFocus」、`AppSidebar.vue`「覆蓋層而非頁：MUST NOT 掛當前頁高亮」、`SettingsModal.vue`「不做檔案選擇對話框」與「狀態列就地呈現，不走 toast」、`view.ts`「下拉展開期間清單與面板的 ↑↓、Esc 不得同時作用」、`detail.ts`「走快照 bundle 而非 openspec status」與「parked 是唯讀」、`types.ts`「park 不可用的兩種形態」與「archived change 對 openspec CLI 同樣不可見」、`ArchivedPanel.vue`「唯讀是雙防線」、`App.vue`「只為 reduced motion 的淡入淡出降級存在」、`normalize-archived.ts`「卡片才不用把日期在名稱裡再讀一次」。驗證：判定表 13 條齊全、每條有判定結果與一句依據
- [x] 1.4 合併 1.2 與 1.3 的結果成一份工作清單（乙丙兩類各自成組，重複出現的以丙類處理）。驗證：清單每一條都標明檔案、原文片段、類別、以及理由要去哪份 `design.md`／`spec.md` 取

## 2. 丙類整句重寫（引用是句子的文法成分）

每一處都先打開對應的 `design.md`／`spec.md` 讀原文，再依 design.md 的 D2 重寫：引用丟掉，引用夾帶的限定詞（實測／定案／打樣結論）留著。

- [x] 2.1 `src/stores/` 三個檔共四處重寫——`settings.ts`「是 design D6 的直接後果」與「design D6 的單一動作」、`detail.ts`「design D7：同畫面變形無 URL 需求」與「design D6 的資料路徑分流」。驗證：這四個註解區塊都不含 `design D`，且各自說得出原本靠編號代指的那件事
- [x] 2.2 `src/stores/detail.ts` 的「新鮮度策略 design D4（stale-while-revalidate）」與 `src/stores/changes.ts` 的「design D5 的來源分流」重寫。驗證：兩處都不含 `design D`，且新鮮度那段讀得出「快取只墊底、不取代重取」的理由
- [x] 2.3 `src/markdown/render.ts` 兩處重寫——「design D2：把來源行號寫進 checkbox 的 `data-line`」與「design D6：外部 URL 新分頁開啟（M4 換系統瀏覽器）」。後者同時拿掉 `M4`，改寫成它實際指的事。驗證：兩處都不含 `design D` 與 `M4`
- [x] 2.4 `src/components/BrandMark.vue` 四處重寫——檔頭「spec brand-mark；design D1–D7」、`DESIGN_SIZE` 上方「design D2：套件的 20 與 64…」、`SPEED_MULTIPLIER` 上方「design D7 實測值」、template 內「才是 design D7 定案的 1.60px」。後兩處分別保留「實測」與「定案」的語意（依 D2）。驗證：四處都不含 `design D` 與 `spec `，且 2.9 秒仍寫得出是量出來的、1.60px 仍寫得出是定案值
- [x] 2.5 `src/components/MarkdownView.vue`「design D2：整片 md-body 一個委派」與 `src/components/PanelShell.vue`「design D5：rule of three 到齊」重寫。驗證：兩處都不含 `design D`，且各自說得出為什麼
- [x] 2.6 `src/api/types.ts` 兩處（「design D2：」與「design D1 的」）、`src/utils/orb-color.test.ts` 兩處「design D3：」、`src/utils/orb-color.ts`「design D3 打樣結論」、`src/styles/interactions.css`「design D3 v3」重寫。驗證：六處都不含 `design D`，且 `orb-color` 兩處仍說得出「不墊下限」與「不四捨五入」各自的理由
- [x] 2.7 `src/stores/view.ts`「spec page-navigation：下拉展開期間清單與面板的 ↑↓、Esc 不得同時作用」重寫（此處同時被 1.3 列為乙類候選，以丙類處理即涵蓋）。驗證：不含 `spec `，且說得出為什麼兩邊的按鍵不能同時作用

## 3. 乙類改寫（只寫規則沒寫理由）

依 design.md 的 D1：每一處寫「為什麼不能那樣做」＋「真要達到那個目的該走哪條路」，約四行。理由一律回原始 `design.md`／`spec.md` 對照原文，不憑印象重寫。

- [x] 3.1 `src/components/BrandMark.vue` 的 `syncRunState` 註解改寫成 design.md D1 裡逐字確認過的那四行。驗證：註解不含 `design D`，且同時出現「視窗看得見但沒焦點」的理由與「要再省電就降重畫頻率」的替代路
- [x] 3.2 改寫 1.3 判定為乙類的其餘各處，逐處套同一標準。驗證：每一處改完都不含 `design D`、`spec <名>`、`.md` 路徑與 `M`／`C`／`T` 代號，且禁令旁邊讀得到理由
- [x] 3.3 對 1.3 判定為甲類（理由已寫在上面幾行）的候選，確認本次一行未動。驗證：`git diff` 不含這些位置

## 4. 收尾與驗收

- [x] 4.1 確認沒有留下任何「補上 change 名」的折衷寫法（依 design.md D3）。驗證：對本次改動的檔案跑 `git diff`，新增行不得出現 `design D`、`add-orb-logo design`、`spec <名>`、`openspec/`、`docs/`
- [x] 4.2 確認指向程式碼自己的引用一行未動。驗證：`git diff` 不含 `見 settleMove`、`依 projects.ts 慣例`、`機制見 interactions.css`、`見 OptimisticMove`、`見 orb-color.test.ts` 這些字串的增刪
- [x] 4.3 確認本次只動註解。驗證：`git diff` 不含任何 code 邏輯、變數名或格式變動（判準對齊 proposal.md「純註解改動：不動任何 code 邏輯、不動格式、不動規格文件本身」與 design.md Non-Goals「不動任何 code 邏輯、變數名、格式」）。目前唯一落在註解外的改動是 `src/utils/orb-color.test.ts` 兩處 `it()` 測試名裡的字串，由 2.6 明令要改：測試名是給人讀的描述文字，不是可執行邏輯、不是變數名、也不是格式，改它不動任何一條斷言與執行路徑，因此仍落在本條允許的範圍內
- [x] 4.4 重跑 1.2 的丙類掃描指令。驗證：掃描結果為空——所有「引用當句子成分」的寫法都已消除
- [x] 4.5 跑 scoped lint（不帶 `--fix`）與改動檔的既有測試。驗證：lint 無紅燈、測試全過
- [x] 4.6 產出人工驗收清單：逐條並列「原始 `design.md`／`spec.md` 出處原文」與「改寫後的註解」，供人核對理由有沒有搬走樣。驗證：清單涵蓋第 2、3 章動過的每一處，且每條標明來源檔案與決策編號
