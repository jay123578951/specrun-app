# add-archived-view Design

## Context

動機見 proposal.md。制約現狀：

- openspec CLI 完全不認識 archived change——`list` 無相關選項、`status`／`show` 對 archive 下的目錄回 error（2026-08-17 實測）。「引擎外包 CLI」的正路在此走不通。
- park 機制（P1）已確立檔案層直讀先例：目錄列舉為準、現場解析 tasks、不做快取（`server/api/parked.get.ts`、`src/api/normalize-parked.ts`）。
- slideover 已有兩個使用者：`ArtifactPanel`（tabs＋可勾 tasks）與 `SpecPanel`（單文全文）。`SpecPanel.vue` 註解明言「rule of three，等 archive 頁落地再抽共用外殼」——本 change 即第三處。
- 換頁機制為 `stores/view.ts` 的 `AppView` 聯集（C8 定案不引入 router），註解已預告 Archived 落地前不進聯集。

## Goals / Non-Goals

**Goals:**

- Archived 清單與唯讀詳情落地，缺頁收尾（Settings 除外，屬 M3）。
- slideover 外殼抽共用，三處（Artifact／Spec／Archived）共用同一副定位、header 骨架與進出場。

**Non-Goals:**

- 不做 archive 相關操作（unarchive、開啟編輯器等）——操作面屬 M3。
- 不做分頁與搜尋（刻意留白，見 Open Questions 前的風險段）。
- 不擴充 watcher 監看 archive 目錄。

## Decisions

### D1 資料源：檔案層直讀，CLI 零參與

直讀 `openspec/changes/archive/`，目錄列舉為準、現場解析。替代方案「等 CLI 支援」不可控（upstream 無此功能跡象），「自建快取」對幾十筆本地小檔案是過度設計。park 先例已證明檔案層直讀與「引擎外包」原則可並存：列目錄、讀 Markdown 不涉任何規格語意。

### D2 API 形狀：比照 parked 的兩條 route

- `GET /api/archived`：清單一趟回傳——目錄列舉＋每目錄現場解析 `tasks.md` 算進度。單筆解析失敗只降級該卡（無進度），不拖垮清單。
- `GET /api/archived/[name]`：詳情打包——現場列舉 tabs（見 D4）＋逐檔讀取。

route 只做 IO，解析集中在 `src/api/normalize-archived.ts`（純函式，web 與 M4 Tauri 版共用）；countTasks 等既有邏輯自 `normalize-parked.ts` 抽出共用，不複製。

### D3 卡片：名稱去前綴、日期另欄、進度醒目規則

目錄名 `YYYY-MM-DD-<name>` 拆成日期與名稱兩欄，不重複顯示；前綴解析不到就整名照列、無日期欄。進度全完成淡化、未完成醒目——「歸檔時沒做完」是回顧時的異常訊號，讓它自己跳出來（decisions 定案）。

### D4 詳情 tabs：現場列舉，含 delta spec

archived 沒有 `openspec status` 可問、也沒有 park 快照 metadata，tabs 只能現場列舉：頂層 `*.md` ＋ 遞迴 `specs/**/spec.md`（tab 名 `specs/<capability-path>`）。順序 proposal → design → delta specs（字母序）→ tasks → 其他（字母序）。含 delta 的理由：主 specs 只有合併後最終態，「當時動了哪些規格」只存在 delta 裡，正是回顧的主要動機；且與 parked 詳情（快照含 delta）形狀一致。

### D5 slideover 外殼抽共用（rule of three 到齊）

抽 `PanelShell`：定位／底色／左緣線、header 骨架（收合鈕＋右側動作槽）、捲動容器與捲動歸零。進出場動畫維持在 App.vue 的 `PANEL_MOTION`（三頁共用同一組值）。ArtifactPanel／SpecPanel 改為填 slot，行為不變——純重構，spec 不動。

### D6 狀態管理：新 `stores/archived.ts`，不塞 detail store

比照 `stores/specs.ts` 的 enter／reset 生命週期（進頁載入、離頁清空、切頁即關）。不併入 `detail.ts`：那裡綁著 watcher 同步、prefetch 快取與 parked 分流，archived 全都不需要，硬塞只會讓兩邊的失效語意互相污染。

### D7 唯讀雙防線

UI 層 checkbox 不可勾（`MarkdownView` 不開 interactive）＋ store 層無寫入路徑（archived store 根本不暴露 toggle）。比照 parked 的防線思路，但更徹底——parked 走 detail store 需要第二道擋寫，archived store 天生沒有寫入面。

## Risks / Trade-offs

- [archive 只增不減，清單解析成本隨量線性成長] → 本地小檔案、幾百筆內無感；量真的痛再開分頁／搜尋 change（刻意留白，非遺漏，下游勿補）。
- [目錄名格式偏離慣例（手動搬移、無日期前綴）] → 解析失敗降級為無日期、排序墊底，清單不炸（spec 已規範）。
- [外殼抽共用動到既有兩個面板] → 純重構不改行為，靠既有頁面的人工驗收兜底；重構任務與新功能任務分開排，壞了可獨立回退。

## Open Questions

無——分頁／搜尋屬刻意留白（見 Risks），不是待答問題。
