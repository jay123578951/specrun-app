## Context

- C1 已就位：`OpenSpecGateway.listChanges()`（web 版走 Nitro route）、「route 只轉送 probe、解析與錯誤分類全在 shared normalize」的 D1 分層、D1 tokens（含 `read-*` 閱讀字級、68ch 欄寬）。
- 詳情檢視的結構層骨架已在 `docs/ui-structure-decisions.md` 收斂（收合變形、窄軌、tabs 政策、已否決項），本 design 沿用不重議。
- CLI 實測：`openspec status --change` 只認進行中 change（archive 不可查），`artifactPaths.<id>.existingOutputPaths` 可區分缺件（空陣列）與既存檔案；specs 的 outputPath 為 glob、可對應多檔。
- 需求動機見 proposal.md；行為契約見三份 delta spec。

## Goals / Non-Goals

**Goals:**

- 詳情資料一趟打包的 gateway 能力，維持「M4 換 Tauri 殼只動 gateway 實作」的分層。
- 收合變形＋窄軌＋tabs＋Markdown 唯讀渲染的完整動線，視覺只用既有 tokens。

**Non-Goals:**

- tasks checkbox 互動（C4）、watcher 自動刷新（C3）、hover 動作（M2/M3）。
- 「Open in editor」按鈕與相對路徑連結開啟（整組延後，頭部僅預留動作區位置）。
- Archive／Specs 瀏覽（詳情僅服務 Active 清單）。
- 視覺打磨與動畫精修（C7）；動效數值與曲線引用 ui-motion skill 固定表，不在此重抄。

## Decisions

### D1：詳情資料單一 endpoint 一次打包

`GET /api/changes/:name`：server 端跑 `openspec status --change <name> --json`，隨即依 `artifactPaths` 讀齊全部既存檔案內容，一趟回傳。棄案「兩段 lazy（先 tabs、點 tab 才讀檔）」：artifact 僅數 KB，打包成本趨近零，換來切 tab 零延遲、全程單一 loading 狀態；C3 watcher 刷新沿用同一支。

### D2：沿用 probe → shared normalize 分層

route 回傳 `ChangeDetailProbe`（status 呼叫的原始輸出＋各檔讀取結果），解析與錯誤分類在 `src/api/normalize.ts` 純函式完成——與 C1 的 `ChangeListProbe` 同構，M4 Tauri 版餵同一份 normalize。錯誤分類沿用既有三類（見 openspec-gateway delta）；change 不存在（CLI 回報 change 層錯誤）歸「呼叫或解析失敗」。

### D3：讀檔白名單

server 只讀 `artifactPaths` 所列路徑，不開任意路徑讀取端點；回應不含清單外檔案（含 `.openspec.yaml`）。這是 App 第一次繞過 CLI 碰檔案系統——規格語意仍全在 CLI，fs 只做原始內容搬運，薄殼原則不破。

### D4：新鮮度＝即時優先＋靜默更新（stale-while-revalidate ＋預載＋持久化）

快取每個 change 的 detail 並持久化（localStorage）：點開有快取的 change 立即顯示、零等待，背景仍每次重取，內容有變才靜默換上並保留捲動位置。清單載入完成後背景依序預載各 active change 詳情（使用者點開尚未預載者，該項插隊優先）——啟動可接受讀取時間，啟動後的操作零等待。保鮮語意不丟——快取只墊底、不取代重取，舊內容最多存活一個請求（實測 CLI 一趟約 1s，大頭是 spawn）。預載屬「掛載時載入一次」的延伸，非輪詢，不違反 C1「不自動重新載入」約束（此延伸已明寫進 spec）。棄案「每次清空重取＋skeleton 過場」（本 design 初版）：驗收後推翻，每次點開等 ~1s 的體感撐不起高頻切換的監視器用法。

### D5：Markdown 管線＝markdown-it ＋ GFM ＋ shiki

markdown-it（VitePress／Slidev 同源）；GFM 表格與 task list（checkbox 渲染後強制 disabled）；shiki 高亮、暗色主題對齊 tokens。保持 markdown-it 預設 `html: false`——本機信任內容仍不開 raw HTML 注入面。shiki 用按需語言載入（fine-grained bundle），首包不吞全語言集。棄案「先無高亮 C7 再補」：artifact 內 code fence 密度高，無高亮的閱讀品質撐不起 dogfood。

### D6：連結政策僅做外部 URL

外部 URL `target="_blank"`（M4 換系統瀏覽器開啟）；相對路徑連結渲染為非互動弱化樣式。artifact 互跳需「路徑 → tab」映射＋specs 串接錨點對位，實際內容多以 inline code 引用、痛感未證實，延後。

### D7：狀態管理不引入 router

詳情開合、當前 change、當前 tab 存 Pinia（changes store 擴充或新 detail store，實作時定）；同畫面變形無 URL 需求，C1 既無 router 慣例延續。tab 記憶（切 change 保持＋fallback）是 store 邏輯，不進元件。

### D8：載入與錯誤呈現對齊 C1 慣例

skeleton 的分界＝「誰觸發的讀取」：開卡片／切換（導航動作）不出現讀取動畫——無快取可顯示時面板空著或僅一個小型安靜的載入提示（預載＋持久化後此路徑幾乎不會被看到）；使用者主動觸發的手動刷新則清空面板、大膽用 skeleton 回饋（比載入文字好看，且刷新本來就是「我要等新資料」的明示動作）。錯誤呈現分兩路：無內容可顯示時失敗＝面板內可重試提示；背景重取失敗且畫面已有內容＝不打擾、繼續顯示舊內容（頂多角落小型提示）。CLI 不可用／非 openspec 專案沿用清單層常駐 banner／主區提示，不在面板重複發明。

## 佈局 wireframe（結構層，動工前人工審）

```
┌─側欄────┬─窄軌──────┬─內容面板────────────────────────────┐
│         │ Active(3) ⟳│ add-artifact-view        （動作區預留）│
│ (C1 不動)│▸add-artif…│ [proposal] design  specs  tasks      │
│         │ ▓▓▓░░ 3/7 │──────────────────────────────────────│
│         │ fix-watch…│ ## Why                               │
│         │ ▓░░░░ 1/4 │ Markdown 全寬渲染（68ch、read tokens）  │
│         │           │ …                                    │
└─────────┴───────────┴──────────────────────────────────────┘
```

- 窄軌項：change 名（mono）＋迷你進度；當前項高亮（accent 底）。
- 頭部：change 名標題；右側動作區空置預留（M3 填）。
- tabs：ui-sm 字級，選中 accent 語意；缺件 tab 樣式與一般 tab 同、不灰化。

## Risks / Trade-offs

- [shiki bundle 偏重] → 按需語言載入＋只預載常見語言（md/ts/vue/bash/json）；體積仍超標則降級 CSS 變數主題單色高亮，記入 C7 觀察。
- [每次切換 spawn CLI（實測 ~1s）] → 暖路徑由快取吸收（零等待）；冷路徑由啟動預載＋localStorage 持久化壓到「全新 change 在預載排到前被點開」一種情形。預載依序發、不並發轟 CLI；active change 數少，啟動幾秒內抓齊。
- [持久化快取跨 session 較舊] → SWR 背景重取 ~1s 內自我修正，符合「拿到舊的無所謂、更新到了畫面直接改」的定調；localStorage 讀寫失敗靜默降級為記憶體快取。
- [點開瞬間 change 被 archive／刪除] → 歸「呼叫或解析失敗」可重試路徑，App 不崩潰；提示文案細節實作時定。
- [收合變形動畫與資料載入並行] → 變形立即開始；暖路徑面板直接帶內容變形，冷路徑面板先空著（小型載入提示），避免「等資料才動畫」的滯澀感。
- [靜默換新造成畫面跳動] → 背景重取回來內容相同就不重繪，有變才換上並保留捲動位置。

## 刻意留白（非遺漏，勿誤補）

- 手動 refresh 控制在詳情模式的位置（建議窄軌頂部，實作時依空間定）。
- 變形動畫具體數值與曲線——ui-motion skill 固定表接管。
- change 消失提示的具體文案。
