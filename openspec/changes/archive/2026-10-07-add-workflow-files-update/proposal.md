# add-workflow-files-update

## Why

每個專案裡都有一份 openspec 產生的流程檔（`.claude/commands/opsx/`、`.claude/skills/openspec-*/`），AI 執行 `/opsx:*` 時讀的就是這些檔案。升級 openspec CLI 不會改到它們，每個專案要各自跑一次 `openspec update` 才會用上新版寫法。

專案一多就會漏：App 專案清單裡的 6 個專案目前分布在 1.2.0、1.8.0、1.13.1、1.14.1 四個版本。要知道哪個落後，得逐一進專案查看。

## What Changes

- Settings 新增「Project workflow files」區，讀取 App 專案清單裡每個專案的流程檔版本，並與 App 目前使用的 openspec CLI 版本比較。最上方顯示目前專案，其他專案收在可展開的「Other projects」裡。
- 流程檔版本比 CLI 舊的專案，那一列有 Update 按鈕。按下後 App 在背景對該專案執行 `openspec update <專案路徑>`，結果就地顯示在那一列。
- 只有逐一更新，沒有「全部更新」。
- 其他狀態只顯示、不放按鈕：已是最新、比 CLI 新、沒有設定流程檔（Not set up）、資料夾不存在。
- 版本只看 Claude Code 的流程檔（`.claude/skills/openspec-*/SKILL.md` 開頭的 `generatedBy`），因為 CLI 沒有查詢流程檔版本的指令。
- 桌面形態的專案授權額外涵蓋 `.claude/skills/`，讓 App 讀得到這些檔案。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `app-settings`：新增「Project workflow files」區的呈現與逐一更新操作。
- `openspec-gateway`：新增「專案流程檔版本讀取通道」與「專案流程檔更新通道」。
- `desktop-shell`：專案路徑的檔案存取授權加上 `.claude/skills` 子目錄。

## Impact

- 共用：`src/api/` 新增流程檔版本解析（`generatedBy` 讀取、取最舊、與 CLI 版本比較）與更新結果解析；`src/api/types.ts` 新增對應型別與 Gateway 方法。
- 後端（Nitro）：新增讀取各專案流程檔版本、執行更新的 API。
- 桌面（Tauri）：`src-tauri/src/lib.rs` 的 `allow_path` 加上 `.claude/skills`；`src/api/desktop/` 新增同語意的讀取與更新。
- 前端：`stores/settings.ts` 與 `SettingsModal.vue` 新增這一區。
- 順序：在 `adopt-openspec-1-14` 之後實作，兩者都會改到 `SettingsModal.vue` 與 `stores/settings.ts`。
