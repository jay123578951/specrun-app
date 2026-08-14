## Context

見 proposal.md（Why / What Changes）。既有相關現況：

- 渲染管線 `src/markdown/render.ts` 以 markdown-it-task-lists `{ enabled: false }` 呈現唯讀 checkbox，註解明留 C4 開口。
- gateway（`src/api/types.ts` 的 `OpenSpecGateway`）目前全唯讀；詳情 route 已實作 artifactPaths 白名單讀檔（design D3 of C2）。
- C3 live-refresh 已就位：任何 `openspec/changes/` 下的檔案變動 → SSE 通知 → 清單與當前詳情重取 → 「無差異不重繪」。
- 詳情內容有跨 session 快取；畫面渲染來源是 store 內的檔案內容字串。

## Goals / Non-Goals

**Goals:**
- tasks tab checkbox 點擊 → 檔案寫回的最短閉環，寫入面收斂到最小。
- 自我觸發的 watcher 重取不造成閃爍或狀態跳動。

**Non-Goals:**
- 任何 tasks 以外的寫入（編輯內容、custom schema artifact 勾選）。
- 進度語意的自行推導——數字永遠等引擎重算。
- 多檔 tasks artifact 的勾選（見 D6）。

## Decisions

### D1：寫入請求的形狀——不送路徑，送「行號＋行原文」
`POST /api/changes/:name/tasks/toggle`，body 只帶 `{ line, expectedText, checked }`（`line` 為 0-based 來源行號）。伺服端以 `openspec status --change <name> --json` 回傳的 tasks artifact `existingOutputPaths` 解析目標檔案——client 無從指定任意路徑，白名單策略與 C2 詳情讀檔同構。解析結果以 change 名為鍵快取於 server 記憶體：使用前驗證檔案仍存在，命中即免 CLI；未命中或檔案已不在才重跑（CLI 一趟實測 ~1s，逐次重跑會把 in-flight 鎖定窗口拉長到肉眼可感，連續勾選的第二下被吃掉）。捨棄「client 帶路徑、server 驗證成員資格」：少一個可疑輸入面，且 spec-driven 的 tasks 恆為單檔，無歧義需要路徑消除。

gateway 介面對應新增 `toggleTask(changeName, input): Promise<ToggleResult>`；`ToggleResult` 三分：成功／衝突／失敗（含訊息），對齊 spec 的衝突可區分要求。M4 Tauri 版以 fs plugin 重寫實作，介面不變。

### D2：行號來源——markdown-it token 的 `map`
task list 項目渲染時，自 token `map`（來源行區間起點）把行號寫進 checkbox 的 `data-line` 屬性；`expectedText` 由 client 從手上的來源字串按行號取出。點擊經 `md-body` 事件委派接住，不逐顆綁 listener。渲染來源與 store 快取是同一份字串，行號天然一致。

### D3：翻行語法判定——與 plugin 判定對齊的單一 regex
伺服端以 `^(\s*(?:[-*+]|\d+[.)])\s+\[)[ xX](\])/` 型式的 regex 認定可翻轉行並翻轉括號內字元：勾選寫入 `x`、取消寫入空格。判定範圍須涵蓋 markdown-it-task-lists 認得的集合（`-`/`*`/`+`、有序清單、縮排子項、大寫 `X`），實作時以測試對照 plugin 行為鎖定一致性（spec「判定一致性」requirement 的落點）。`expectedText` 比對在前、語法判定在後——行文不符一律回衝突，不進翻行邏輯。

### D4：併發比對與寫回——整檔讀、單行換、byte 保真
寫入流程：讀整檔 → 以保留行尾符的方式切行（`\r\n`／`\n` 原樣留在行上）→ 取第 `line` 行、去行尾符後與 `expectedText` 全等比對 → 不等回 409（衝突）；相等則僅置換勾選字元、原樣拼回、整檔寫回。除目標行的一個字元外，寫回內容與讀出 byte-identical——EOL 風格、結尾有無換行、其他行的外部修改全部保留。放棄 line-level partial write（fs 無此原語，整檔寫回本就原子性較好）。

### D5：樂觀更新的實作位置——改 store 的來源字串，不改 DOM
點擊後 detail store 直接對快取的 tasks 檔案內容字串做同一套「翻行」置換並觸發重渲染——畫面立即呈現目標狀態，且與寫入成功後檔案的真實內容一致，watcher 重取回來的內容與快取全等 → 既有「無差異不重繪」自然吸收，零閃爍。失敗（409 或 IO）則把字串改回並跳 toast；衝突情境下隨後的變動通知會把外部新內容帶回。in-flight 以「行號集合」鎖定：集合內的行忽略點擊；請求結束（成敗皆然）移除。不採「DOM 上先勾、資料層後補」：單一資料源，彈回與重渲染走同一條路。

### D6：互動開關的邊界——僅單檔 tasks tab
checkbox 互動僅在「artifact id === `tasks` 且 files 恰為一個」時啟用；其他 tab 與多檔情形維持 `enabled: false` 的唯讀渲染。渲染層以參數區分兩種模式（唯讀管線不動），interactive 模式順帶補 checkbox 的 hover／focus 視覺狀態（tokens 內解決，不引入新視覺語言）；pending（in-flight 鎖定）刻意不做視覺暗示——變暗或 progress 游標會被讀成載入等待，與「點擊立即呈現目標狀態」的體感相悖（驗收回饋後修訂）。

## Risks / Trade-offs

- [plugin 判定與伺服端 regex 漂移（plugin 升版）] → 一致性測試以固定樣本同時餵前端渲染與伺服端判定，漂移時測試先紅。
- [路徑快取失效（tasks 檔被移動、change 重建）] → 使用前 existence 檢查擋掉「檔案不見」；「路徑換了但同名舊檔仍在」的殘餘窗由既有 `expectedText` 逐行比對兜底——內容不符即回衝突、不誤寫。（原「每次重跑 CLI」設計實測一趟 ~1s、驗收時鎖定窗口成為體感痛點，依本欄原預告改上路徑快取。）
- [樂觀翻後、watcher 通知前的短窗內使用者連續勾多顆] → 各顆獨立請求、獨立行鎖，互不阻塞；行號互不重疊故寫回不互相衝突，但仍有 A 寫回觸發的重讀與 B 的比對交錯的理論窗——伺服端寫入以 per-change 序列化（單一 in-process queue）消除。
- [快取字串被樂觀修改後寫入失敗且變動通知未至（檔案其實沒變）] → 彈回即是把字串改回原值，不依賴通知；通知只在檔案真的變過時才需要。

## Open Questions

（無——可勾範圍、回饋策略、併發策略均已於探索階段收斂。）
