## Why

加入專案目前只有手打／貼上路徑一種方式，對使用者是全流程中最生硬的一步：要先去 Finder 或終端機把路徑複製出來，打錯一個字元就驗證失敗。前端早已預留 `canPickFolder` / `pickFolder()` 介面口（design D5，原設想 Tauri 才具備），而本 App 的 Nitro server 跑在使用者本機——由 server 端開作業系統原生資料夾選擇 dialog 即可在 web 版直接補上這個能力，不必等 Tauri 外殼。

## What Changes

- 新增 server 端 pick-folder API：透過 macOS `osascript`（`choose folder`）開原生資料夾選擇 dialog，回傳使用者所選資料夾的絕對路徑；使用者取消則回傳空結果。
- 能力偵測由 server 回報：server 依平台（目前僅 macOS）判定是否具備開 dialog 的能力，並隨結果一併回傳，前端不寫死。
- 前端 web gateway 的 `pickFolder()` 接上新 API；點「Add project」直接開 dialog，選定即送驗證加入。
- **原生 dialog 成為加入專案的唯一入口：移除手打／貼上路徑輸入列**（驗收回饋——有選擇器就沒人會手打，而且輸入列展開後不會自動收起，造成 dialog 取消後畫面仍留著一個輸入框的怪異狀態）。
- 加入失敗（路徑無效、無 `openspec/`、重複加入）與 dialog 不可用／開啟失敗**一律以 toast 提示**：輸入列消失後沒有貼錯誤的位置，改用全 App 共用的 toast。
- dialog 開啟時將其帶至前景（osascript 端處理），避免開在瀏覽器視窗後面。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `project-management`：「加入專案」需求改寫——加入入口 SHALL 以原生 dialog 選取資料夾，不再提供手打路徑的替代輸入；驗證失敗與 dialog 不可用皆 SHALL 以 toast 提示。選取後的驗證、加入即切換、重複加入語意不變。

## Impact

- Server：新增 `server/api/` 下的 pick-folder endpoint 與對應 util（spawn osascript）。
- 前端：`src/api/web-gateway.ts`（`pickFolder()` 實作）、`src/api/types.ts`（`canPickFolder` 移除、`pickFolder` 改回傳帶狀態的結果）。
- 前端 UI：`ProjectSwitcher.vue` 移除路徑輸入列與其狀態；「開 dialog → 驗證加入 → 失敗 toast」上移到 projects store，側欄與 `ChangeList`／`SpecsView`／`ArchivedView` 三處空狀態入口共用同一個動作；store 的 `addFormOpen` 一併移除。
- Toast：新增 `info` 語氣（`notifyInfo`）與對應圖示，供「已在清單中」這類非失敗提示使用；既有呼叫端維持失敗語氣。
- 相依：無新套件；僅依賴 macOS 內建 `osascript`。
- 非 macOS 平台無法加入專案（點擊只出 toast 說明）——本 App 目標平台為 macOS，M4 Tauri 外殼同樣具備原生 dialog。
