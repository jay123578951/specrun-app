## 1. Gateway 詳情能力（資料層）

- [x] 1.1 定義詳情型別：`ChangeDetailProbe`（status 原始輸出＋各檔讀取結果）與 normalize 後的 `ChangeDetail`（artifact 清單、缺件標示、檔案內容），沿用三類錯誤型別
- [x] 1.2 新增 Nitro route `GET /api/changes/:name`：spawn `openspec status --change <name> --json`，依 `artifactPaths` 讀齊既存檔案（白名單，不含清單外檔案），原樣打包回傳
- [x] 1.3 在 `src/api/normalize.ts` 新增詳情 normalize 純函式：解析 probe、缺件與錯誤分類（change 不存在歸「呼叫或解析失敗」）、tabs 順序沿用 CLI
- [x] 1.4 gateway 介面擴充 `getChangeDetail(name)`，web 版實作接 route＋normalize
- [x] 1.5 詳情 normalize 單元測試：正常打包、缺件、custom schema、change 不存在、白名單外檔案不外流

## 2. Markdown 渲染管線

- [x] 2.1 加入 markdown-it（GFM 表格、task list）與 shiki（按需語言：md/ts/vue/bash/json；暗色主題對齊 tokens），保持 `html: false`
- [x] 2.2 建 `MarkdownView` 元件：read tokens 排版（15px／1.85／68ch）、checkbox 強制 disabled、外部連結 `target="_blank"`、相對連結渲染為非互動弱化樣式

## 3. 詳情檢視 UI

- [x] 3.1 Pinia 狀態：詳情開合、當前 change、當前 tab（切 change 保持＋fallback proposal 邏輯）、session 快取＋每次進入／切換背景重取（stale-while-revalidate：有快取立即顯示、內容有變才靜默換上並保留捲動位置）
- [x] 3.2 收合變形佈局：清單⇄窄軌＋內容面板同畫面變形（動效引用 ui-motion 表），Esc 回全寬且清單捲動位置保留
- [x] 3.3 窄軌元件：change 名＋迷你進度、當前項高亮、點擊與 ↑↓ 切換、頂部 refresh 控制（位置屬刻意留白，實作時定）
- [x] 3.4 內容面板：頭部（標題＋動作區空置預留）、artifact tabs 動態列出（不寫死名稱）、缺件 tab 可點顯示空狀態、specs 多檔串接加標頭
- [x] 3.5 載入與錯誤狀態：無快取墊底路徑空面板或小型載入提示、導航動作不用 skeleton 動畫、不留前一 change 內容；無內容時失敗可重試提示（與空狀態文案可區分）、背景重取失敗且已有內容則不打擾
- [x] 3.6 `ChangeCard` 接上點擊開啟（hover 仍僅視覺抬升）
- [x] 3.7 啟動預載：清單載入完成後依序背景預載各 active change 詳情，點開尚未預載者該項插隊優先
- [x] 3.8 快取持久化：detail 快取存 localStorage（跨 session），讀寫失敗靜默降級為記憶體快取
- [x] 3.9 詳情手動刷新：refresh 控制觸發清空面板＋skeleton（ArtifactSkeleton 回歸此用途），完成後渲染最新內容

## 4. 驗收與收尾

- [x] 4.1 互動狀態盤點：tabs／窄軌項／checkbox／連結依 ui-interaction-states 檢查表補齊各態
- [x] 4.2 對三份 delta spec 逐 scenario 人工驗收動線確認（含 custom schema 測試資料、change 開啟瞬間被移除的重試路徑）
