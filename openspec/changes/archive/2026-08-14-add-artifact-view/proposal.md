## Why

C1 之後 App 只能看 change 清單與進度數字，看不到 artifact 內容——要看 proposal／design／tasks 仍得回編輯器，App 還不構成可用的 Viewer。C2 補上詳情檢視與 Markdown 唯讀渲染，讓「掃清單 → 點開看內容」的核心動線成立（roadmap M1 的主體價值）。

## What Changes

- 卡片變為可點擊：點開後主區收合變形——清單縮成窄軌、內容面板取得其餘寬度（非換頁、非彈窗）。
- 內容面板依 `openspec status --change --json` 的 `artifactPaths` 動態列出 artifact tabs，Markdown 唯讀渲染（含 GFM 表格、唯讀 task list、code 高亮）。
- 窄軌支援點擊與 ↑↓ 鍵切換 change、Esc 回全寬清單（捲動位置不丟）。
- gateway 新增「change 詳情」能力：單一呼叫回傳 tabs 與全部 artifact 內容（server 端跑 status 後讀齊檔案，一趟打包）。
- 明確不含：tasks checkbox 互動（C4）、hover 動作（M2/M3）、「Open in editor」按鈕與相對路徑連結開啟（延後）、watcher 自動刷新（C3）。

## Capabilities

### New Capabilities

- `artifact-view`: 詳情檢視——收合變形佈局、窄軌互動、artifact tabs 與 Markdown 唯讀渲染的行為規格。

### Modified Capabilities

- `change-list`: 「卡片為純展示」要求改為卡片可點擊開啟詳情；hover 動作維持不做。
- `openspec-gateway`: 新增取得單一 change 詳情（artifact 清單＋檔案內容）的要求，含讀檔路徑白名單與錯誤分類的延伸。

## Impact

- 前端：新增詳情面板、窄軌、tabs、Markdown 渲染元件；`ChangeList`／`ChangeCard` 加點擊行為；Pinia store 擴充詳情狀態。
- 後端：新增 Nitro route（change 詳情），沿用 probe → shared normalize 的 D1 分層。
- 依賴：新增 markdown-it（＋GFM 相關 plugin）與 shiki。
