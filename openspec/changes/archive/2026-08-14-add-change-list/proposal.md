# add-change-list

## Why

App 目前只有骨架與設計基礎，尚無任何真實畫面。C1 要立起第一個核心畫面——change 清單＋任務進度，同時第一次兌現 roadmap 的「前後端呼叫抽 interface」承諾：建立 openspec CLI 的呼叫邊界（gateway），讓 M4 套 Tauri 殼時只需替換一個檔案。

## What Changes

- 新增 `GET /api/changes`：Nitro route spawn `openspec list --json`（單次 spawn，不做 N+1），原樣轉送 stdout 與 exit code，route 本身不做 normalize。
- 新增 shared normalize 純函式：CLI 原始 JSON → App 型別，含錯誤分類（CLI 缺失／目標路徑非 openspec repo／spawn 或解析失敗）；「非 openspec repo」以 `root.path` 與設定路徑的 canonical 比對＋exit 1 diagnostic payload 判定，另以 `root.source: implicit` 補強（見 design D3），不以 `root.source` 為唯一判準。
- 新增前端 gateway（沿 `src/api/` 既有慣例）：介面抽象供 M4 以 Tauri shell plugin 實作替換。
- 新增主區 change 清單畫面：卡片（標題／進度條＋n/m／相對時間）、Active 群組、skeleton 載入態、手動 refresh（保留舊資料、按鈕轉圈）、錯誤呈現（CLI 不可用 banner／非 openspec 專案提示／首載失敗的可重試提示／暫時性失敗 toast）、無 change 空狀態。
- 新增側欄靜態殼：四段結構依 `docs/ui-structure-decisions.md`，僅專案項徽章接真實資料，其餘項目無功能。
- 專案路徑以 env 指定、fallback 至 repo 自身路徑（多專案管理在 C5）。

明確不包含（後續 change 實作）：Why 摘錄（C2，規格已定於結構文件，待 fs 通道）、卡片點擊詳情（C2）、hover 動作 Park／複製／刪除（M2／M3）、watcher 刷新（C3）、checkbox 勾選（C4）、設定頁本體（形態已定案為右側滑入非蓋板 drawer，記於 design）。

## Capabilities

### New Capabilities

- `openspec-gateway`: App 與 openspec CLI 的呼叫邊界——spawn 策略、輸出 normalize、錯誤分類與專案路徑解析。
- `change-list`: change 清單畫面——卡片內容、群組、載入／刷新／錯誤／空狀態行為與側欄殼。

### Modified Capabilities

（無——本專案首批 capability）

## Impact

- `server/api/`：新增 changes route（沿 `health.get.ts` 慣例）。
- `src/api/`：gateway 介面與型別擴充；新增 shared normalize 模組（前後端共用）。
- `src/`：新增清單畫面元件（卡片、skeleton、空狀態、錯誤呈現）、側欄殼；使用 D1 tokens，不新增視覺決策。
- 依賴：無新增 runtime 套件（spawn 用 Node 內建；UI 用既有 UnoCSS／tokens）；工具鏈補兩個 devDependency——`vitest`（normalize 單元測試，專案原本沒有 test runner）與 `@types/node`（route 用 `node:child_process` 等內建模組）。
- 風險：openspec CLI `list --json` 格式變動——normalize 集中一處可控；CLI 版本本機 1.8.0。
