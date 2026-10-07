# adopt-openspec-1-14

## Why

openspec 1.14 補上兩個 App 一直缺的引擎能力：`list --archived --json` 讓 CLI 終於認得已歸檔的 change，`version --check --json` 能回答「有沒有新版、怎麼升級」。

目前 Archived 清單繞過 CLI，自己列目錄、自己數 tasks.md 的勾選，和「引擎完全外包 openspec CLI」的原則不一致。Settings 只顯示目前版本，使用者不會知道 openspec 有新版，也不知道該下什麼指令升級。

## What Changes

- **Archived 清單改用 CLI 讀取**：網頁與桌面兩種執行形態都改成呼叫 `openspec list --archived --json`，進度改由 CLI 計算。卡片的名稱、歸檔日期與排序仍從目錄名的 `YYYY-MM-DD-` 前綴拆出；詳情面板仍直接讀檔案，因為 `status`／`show` 仍不認得已歸檔的 change。
- **BREAKING：Archived 頁需要 openspec 1.14 以上**：CLI 低於 1.14 時，Archived 頁顯示「需要 openspec 1.14 以上」並附 Open settings 入口，不退回直接讀檔。CLI 不可用時，Archived 頁比照 Changes／Specs 頁顯示 CLI 不可用。
- **換 CLI 後 Archived 也重新載入**：在 Settings 套用新的 CLI 後，Archived 資料跟著重載，舊版換新版後「需要升級」會馬上消失。
- **Settings 顯示有沒有新版**：開啟 Settings 時跑 `openspec version --check --json`，在 openspec CLI 區塊顯示四種結果：有新版（附 CLI 給的升級指令與複製鈕）、已是最新版、無法檢查、版本低於 1.14。App 只顯示升級指令，不代為執行；Settings 以外不加提醒。
- Roadmap 頁的引用解析照舊直接列 archive 目錄，不受版本門檻影響。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `archived-view`：清單資料來源改為 CLI；空與錯誤狀態加入「CLI 不可用」與「CLI 版本過舊」兩種呈現。
- `app-settings`：套用新 CLI 後的重載範圍加入 Archived。原 requirement 有一個「archived 不受影響」的情境，行為反轉後無法保留，所以移除整條並以「套用 CLI 後的資料重載範圍」取代。openspec CLI 區塊新增更新檢查結果的呈現。
- `openspec-gateway`：新增「archived 清單以單次 CLI 呼叫取得」與「CLI 更新檢查通道」；錯誤分類新增「CLI 版本過舊」並涵蓋 archived 清單這條讀取路。

## Impact

- 後端（Nitro）：`server/api/archived.get.ts` 改呼叫 CLI；新增更新檢查的 API。`server/utils/archive-store.ts` 的目錄列舉保留給 roadmap 與 archived 詳情使用。
- 桌面（Tauri）：`src/api/desktop/archived.ts` 清單改呼叫 CLI；`src/api/desktop/cli.ts` 加更新檢查。
- 共用：`src/api/normalize-archived.ts` 改解析 CLI JSON；新增更新檢查結果的解析；`src/api/types.ts` 錯誤型別加版本過舊。
- 前端：`stores/archived.ts`、`ArchivedView.vue` 的錯誤狀態；`stores/settings.ts` 的重載範圍與更新檢查；`SettingsModal.vue` 的 openspec CLI 區塊。
- 相依：openspec CLI 最低版本 1.14.0（Archived 頁與更新檢查）；其他頁面不受影響。
