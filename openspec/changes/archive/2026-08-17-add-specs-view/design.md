## Context

動機見 proposal.md（Why）。App 目前是單頁：`App.vue` 固定渲染 ChangeList，slideover 詳情（ArtifactPanel）以容器內絕對定位覆蓋、由 `detail` store 驅動；本 change 首次引入「主區多頁」。決策已於 2026-08-17 srun:decisions 收斂，本文件記錄其結論與實作層選擇。

## Goals / Non-Goals

**Goals:**
- Specs 頁清單＋詳情，行為與既有 slideover 語意一致
- 換頁機制立好地基，後續 add-archive-view 直接沿用

**Non-Goals:**
- Archive 頁（下一個 change）；Settings（併入 M3）
- Specs 頁的 watcher 即時刷新（進頁重載即可，弱一致先例）
- 抽共用 slideover 外殼的重構（見 Decisions）

## Decisions

- **換頁用 Pinia view store、不引入 vue-router**：新增輕量 `stores/view.ts`（`currentView: 'changes' | 'specs'` ＋切換 action，切換時順帶關閉詳情面板）。桌面 App 無 URL／歷史需求，三頁規模引入 router 違反專案「不為不存在的規模設計」慣例；跨元件（側欄、ProjectSwitcher、App 主區）共享狀態故用 store 而非 App 內 ref。
- **導覽回程＝點專案名進入該專案 Changes 主頁**（使用者經 UI 模擬選定）：點任一專案一律落在其 Changes 頁；點目前專案＝從其他頁回主頁、已在主頁無作用。nav 段不加 Changes 項；Specs 項高亮當前頁，Changes 頁以 ● 專案標記兼任位置指示。替代方案「側欄加 Changes 項」「nav 項 toggle」已否決。
- **回主頁攔在 `projects.adopt()`**：目前專案會被三件事換掉——點專案項、加入專案（加入即切換）、移除目前專案（server 接手清單第一個）。後兩者若留在 Specs 頁，清單與面板仍是前一個專案的內容、側欄的 ● 卻已移走，是資料與標示對不上的 bug。`adopt()` 是「目前專案真的換了」的唯一匯流點，回主頁掛在這裡，三個觸發點語意一致，也免得 specs store 再長出一條專案世代的 invalidate 路徑。點目前專案時 `switchTo` 會早退、`adopt()` 不跑，所以那一條由 ProjectSwitcher 的點擊處理器自己呼叫換頁。
- **Specs 清單＝純列表列**（使用者選定）：只用 `openspec list --specs --json` 給的 id＋requirementCount，零額外 CLI 呼叫；不仿 ChangeCard（specs 無進度／時間語意），不做 Purpose 摘錄（需 N 次 `show`，量小但違反最薄原則）。
- **切頁即關、詳情狀態單一份**（使用者選定）：不做 per-view 面板狀態記憶，`detail`（changes）與新的 specs 開啟狀態互不相干且切頁即清，避免回程重置語意的邊界題。
- **新建 SpecPanel 元件，不參數化 ArtifactPanel、暫不抽共用外殼**：ArtifactPanel 綁 change 詳情語意（動態 tabs、tasks 勾選、缺件空狀態），spec 詳情無 tabs 單文件，共用面只剩 header＋定位＋動畫。依 rule of three：等 archive 頁（第三個 slideover 使用者）落地再抽殼，本 change 先以對齊樣式常數（露出寬、進出場動畫值）維持一致。
- **spec 內容走 `openspec show <id> --type spec` 原始 stdout**：CLI 非 JSON 模式直接輸出 spec.md 原文（實測確認），server 端原樣轉交、前端以既有 MarkdownView 渲染——薄殼原則，不用 `--json` 結構化輸出再重組 Markdown。用動詞在前的 `show` 而非 `spec show`：後者已被 CLI 標記 deprecated 並在 stderr 印警告，兩者 stdout 逐 byte 相同（實作時實測比對）。
- **server 端點沿既有慣例**：`server/api/specs.get.ts`（清單）＋`server/api/specs/[id].get.ts`（內容），spawn 走既有 `openspec-cli.ts` util；specs 資料型別與 normalize 進 `src/api/`，錯誤分類沿用 `GatewayError` 三類。

## Risks / Trade-offs

- [`show --type spec` 非 JSON 輸出格式非契約，CLI 改版可能變動（加註記、色碼）] → spawn 無 TTY 下 stdout 實測無 ANSI 色碼（stderr 有，normalize 在唯一出口清掉）；內容原樣轉交所以變動只影響顯示不致崩壞；驗收時人工確認渲染。
- [切頁即關＝低頻頁狀態不保留，重開要多一次點擊] → 使用者已知情選定；specs 內容小、重載成本低。
- [SpecPanel 與 ArtifactPanel 樣式重複] → 刻意取捨（rule of three），archive 頁 change 時償還。

## Open Questions

（無——鍵盤／空狀態／錯誤分層皆沿用既有規格語意。）
