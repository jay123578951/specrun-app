# specrun-app Roadmap

OpenSpec 相容的桌面 spec 管理 App——取代 Spectra，引擎外包給 openspec CLI，只做薄殼 UI，吃到 OpenSpec 的更新紅利。

## 背景與動機

- Spectra（第三方，Tauri v2）已三個月未更新，與 OpenSpec 的演進脫鉤（v1.5~v1.8 的 stores、`skip_specs`、非英文 validate 等都吃不到）。
- Spectra 的維護困境根因：它把整個引擎（validate / archive / schema）重寫進自己的 Rust 核心，OpenSpec 每次演進都要追。
- 本專案的核心架構決策與其相反：**引擎完全交給 openspec CLI（spawn + `--json`），UI 只做薄殼**——openspec 升級即自動獲得引擎紅利。

## 已收斂的技術決策

| 決策點 | 結論 |
|---|---|
| 桌面外殼 | Tauri v2（GUI + 官方 plugin：shell / fs / dialog；不寫 Rust，殼用模板） |
| 前端 | Vue 3 + Vite + UnoCSS + Pinia |
| 引擎 | openspec CLI（`status` / `list` / `instructions` `--json`），不重新實作任何規格語意 |
| Park 機制 | UI 自己的檔案層操作，存放於各 repo 的 `.git/specrun-app/` 內＋輕量 metadata JSON；openspec 與 git 均無感（決策細節見 M2） |
| 指令合併 | slash command 層解決（如收尾＝verify → sync → archive 串一個指令），不進引擎 |
| 開發策略 | 先以本地 web 形態開發（Vite dev），前端與後端呼叫抽 interface，最後套 Tauri 殼 |

### 已知的坑（動工前記住）

- macOS GUI App 不繼承 shell PATH：openspec CLI 路徑要可設定或啟動時偵測（目前本機在 `~/Library/pnpm/openspec`）——由 M4 前置的 `add-settings-modal` 處理。
- Tauri webview 是 WKWebView（Safari 核心），避免 Chrome-only CSS。
- Tauri v2 capabilities 權限模型：fs 路徑與 shell 指令需明確白名單。

## 里程碑與 change 堆疊

**原則：change 一律切小、功能逐步堆疊，一次只開一個進行中的 change。** 每個 change 小到「審 spec 五分鐘、做完當天 archive」。

### M1 — Viewer（拆為小 change 堆疊）

資料全部來自 openspec CLI 的 `--json`。本專案自身的 `openspec/` 目錄就是第一份測試資料（dogfooding）。

| # | change | 內容 | 狀態 |
|---|--------|------|------|
| C0 | scaffold-app-shell | 純環境骨架（Vite+Vue+Nitro 通路），**零視覺決策** | ✅ 2026-08-14 archived |
| D1 | add-design-foundation | 設計基礎：tokens、主題、視覺語言。結構層決策見 `docs/ui-structure-decisions.md` | ✅ 2026-08-14 archived |
| C1 | add-change-list | change 列表＋任務進度（design 附 wireframe 審過才做；路徑先寫死單專案） | ✅ 2026-08-14 archived |
| C2 | add-artifact-view | artifact 唯讀渲染（Markdown）＋收合變形詳情檢視（窄軌＋內容面板、動態 tabs） | ✅ 2026-08-14 archived |
| C3 | add-live-refresh | file watcher 即時刷新 | ✅ 2026-08-14 archived |
| C4 | add-task-toggle | tasks checkbox 勾選（唯一寫入；併發策略見決策清單） | ✅ 2026-08-15 archived |
| C5 | add-project-switcher | 多專案清單與切換（路徑管理從這裡才真正做）：側欄清單、加入／移除／切換、設定檔持久化、每專案徽章 | ✅ 2026-08-15 archived |
| C6 | — | ~~parked 唯讀清單~~ 併入 M2（park 操作存在前唯讀清單恆空，無法 dogfood） | ➡️ 2026-08-15 併入 M2 |
| C7 | add-detail-slideover | 詳情改為右側滑出覆蓋面板：清單不變形不移位、露出區可直接切換 change；移除 ChangeRail 窄軌 | ✅ 2026-08-17 archived |
| C8 | add-specs-view | Specs 頁補齊：capability 清單＋spec 全文 slideover 詳情；App 首次由單頁變多頁（state 切換，不引入 router） | ✅ 2026-08-17 archived |
| C9 | add-archived-view | Archived 頁補齊（缺頁收尾的最後一頁；Settings 不在此列，見下）：檔案層直讀 archive 目錄、唯讀詳情含 delta spec、slideover 外殼抽 `PanelShell` 共用 | ✅ 2026-08-17 archived |
| C10 | | UI 視覺精修（畫面到齊後的整體打磨） | ⏭️ 下一個 |

Settings 不在 M1 之列：它不是缺頁，而是覆蓋層——原併入 M3、2026-08-18 改列為 M4 前置（見下）。

**UI 設計的兩層時間線**：結構層（佈局 wireframe）跟著每個 change 的 design.md 走、動工前人工審；視覺層（tokens／主題）D1 打底、中間 change 只用 tokens 不追求美、C10 收尾精修。

### M2 — Park 機制 ✅ 2026-08-15 完成

Park / unpark 操作與 parked 清單一體（原 C6 併入此處，第一個 change 做完即有真資料可 dogfood）。

| # | change | 內容 | 狀態 |
|---|--------|------|------|
| P1 | add-park-mechanism | park／unpark 操作、Active／Parked 雙群組清單、parked 唯讀詳情（artifact 路徑快照）、非 git repo／worktree 降級禁用、失敗 toast | ✅ 2026-08-15 archived |

已收斂決策（2026-08-15 探索定案，實作後結論不變）：

- **不做 Spectra 轉接器**：實測全機 7 個曾用 Spectra 的 repo，parked 數均為 0——轉接器無既存資料可接，且綁死已停止維護的私有格式。格式自訂。
- **存放位置：`<repo>/.git/specrun-app/parked/<name>/`**（藏進 .git 內部，借鑑 Spectra 實測發現的做法）：git 天然不追蹤 .git 自身 → 無污染免驗證、parked 隨 repo 搬移改名、repo 刪除自動清掉、免 repo-identity 映射。
- **索引縮減為輕量 metadata JSON**（每 repo 一個 `.git/specrun-app/parked.json`）：只記檔案搬移會破壞的資訊——`parkedAt`（清單顯示「停了幾天」）與 park 當下的 artifact 路徑快照（parked 詳情的 tabs 依此列出）；原始 lastModified 不保留（parked 卡片時間欄位顯示 parkedAt，unpark 後回到列表頂端）。「哪些被 park」以目錄列舉為準，任務數／摘要現場解析，不做快取；目錄與 metadata 不一致時以目錄為準。
- **無正常 `.git/` 目錄（非 git repo／worktree）→ park 禁用＋提示**（2026-08-15 decisions 定案）：tooltip 說明原因；worktree 支援（解析 `gitdir:`）記入觀察項。

### M3 — 操作與指令合併

從 UI 觸發常用操作（archive、validate 等）、合併式指令（一鍵收尾）、錯誤與確認流程。

> Settings 原併入本里程碑（理由：設定項要等操作面到齊才有內容可放），已於 2026-08-18 移出——
> M3 的操作面帶來的是**確認流程**而非設定，而唯一的真設定（CLI 路徑）的痛點時機是 M4。

### M4 — Tauri 打包

套上 Tauri v2 外殼、capabilities 設定、`tauri build` 產出 .app 日常使用。

| # | change | 內容 | 狀態 |
|---|--------|------|------|
| S1 | add-settings-modal | M4 前置：openspec CLI 路徑的偵測與覆寫（GUI App 不繼承 shell PATH，不先解決則打包後開起來是空的）、Settings modal 與唯讀環境診斷 | 🚧 進行中 |

## 已收斂決策補充（srun:decisions 產出，propose 時寫入各 change design）

- tasks 勾選併發策略：寫入前重讀檔案、只翻目標行、該行已變則放棄並提示（C4）
- artifact 顯示依 `openspec status --json` 的 `artifactPaths` 動態列出，不寫死名稱（custom schema 必須可用）
- 專案清單手動加入、不做全機掃描；設定存平台慣例位置（macOS：`~/Library/Application Support/`）
- 空狀態：無專案引導加入目錄；openspec CLI 缺失時明確提示
- 多專案側欄徽章＝未 archive 的 change 數，弱一致：啟動與切換時刷新，current 隨變動通知即時；取不到不編數字（C5 定案）
- Parked 群組依 park 時間新→舊排序；只要存在任何卡片，兩群組皆呈現（含數量 0 的空群組——拖曳切換狀態需要恆常存在的落點），兩群組皆空時 Parked 整段不顯示（P1 原定「無 parked 即隱藏」，由 `drag-to-switch-change-state` 推翻並收斂為此例外）
- 詳情採 slideover 覆蓋、不滿版：左側保留露出區可直接點卡片切換；層次靠 surface 色階＋1px 邊框，禁用 box-shadow 與 backdrop（C7 定案）
- 多頁導覽用簡單 view state、不引入 router；點側欄專案名＝回該專案 Changes 主頁；切頁即關詳情面板、不記憶，進頁重新載入不擴 watcher（C8 定案）
- archived change 走檔案層直讀、CLI 零參與（openspec CLI 不認識 archive 下的目錄，`status`／`show` 直接 error）；目錄列舉為準、現場解析 tasks 進度、不做快取，比照 park 先例（C9 定案）
- archived 詳情 tabs 現場列舉且含 delta spec：主 specs 只有合併後最終態，「當時動了哪些規格」只存在 delta 裡；唯讀走雙防線（UI 不開 interactive＋store 無寫入面）（C9 定案）
- slideover 外殼抽 `PanelShell` 共用（Artifact／Spec／Archived 三處到齊，rule of three）；進出場動畫值仍集中在 App.vue 的 `PANEL_MOTION`（C9 定案）
- 仍開放（刻意留白）：Active 列表排序（預設 lastModified 新→舊）、archived 清單的分頁與搜尋（量痛了再開 change）

### 後續觀察項（不排程）

- in-app 陽春編輯（改錯字／小措辭情境）：先以「用編輯器開啟」按鈕滿足，dogfood 後痛感真實存在才評估開 change（成本在併發衝突與編輯體驗無底洞，非存檔本身）。
- OpenSpec Stores 模型穩定後，評估 park 是否可映射過去。
- git worktree 專案的 park 支援（解析 `.git` 檔案的 `gitdir:` 指向）：M2 定案先禁用＋提示，worktree 使用痛感真實再做。
- 拖到清單邊緣自動捲動（`drag-to-switch-change-state` 列為非目標）：change 總量少、兩群組多半同屏可見，捲動需求真實出現再做。
- 觸控裝置的拖曳優化：目前統一走 Pointer Events、不另做手勢處理（桌面 App）；真有觸控使用情境再評估。
- srun kit 的 openspec 後端行升級為一級公民（實際 dogfood 驗證覆蓋度）。
- 把自行設計的 specrun kit 整合進來。
- 卡片「開發中」持續指示（2026-08-17 C10 探索定案）：「正在開發」無檔案系統真值，活動推定（衰減窗口）只是猜、已否決；正解是 pipeline 開工／收工寫 marker 檔的真訊號，綁 kit 整合時一併評估（代價：只覆蓋走流程的開發、中斷殘骸的過期判定、App 與 kit 格式耦合）。另：原結構文件的「watcher 卡片短暫高亮」經對照實際資料流不做——進度條補間＋重排動畫＋時間戳已覆蓋同一問題。

## 工作方式

- 本檔管**方向**（里程碑全貌與 change 堆疊順序）；執行細節在各 change 的 proposal / design / tasks。
- 堆疊順序可調，但每次只開一個進行中的 change；change 完成 archive 後更新上表狀態欄。
- 流程：探索討論（/opsx:explore）→ 決策收斂（/srun:decisions，分支多時）→ propose → 人工審 spec → 實作（/srun:feat）→ archive。
