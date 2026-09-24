# Design

## Context

動機見 proposal.md 的 Why，行為契約見 `specs/roadmap-view/spec.md`。

App 讀資料的三條既有路線：
- **CLI 路線**：change、spec 清單與詳情，spawn openspec CLI。
- **檔案層直讀路線**：archived 與 parked。openspec 不認識它們，所以列目錄、讀 Markdown。
- **兩種執行形態各一份 IO**：
  - web 走 Nitro route（`server/api/archived.get.ts`）；
  - 桌面走 Tauri fs（`src/api/desktop/archived.ts`）；
  - 兩份只負責造「probe」（原始檔案資料），解析、排序、錯誤分類放在兩邊共用的純模組（`src/api/normalize-archived.ts`）。

規劃檔同樣不在 openspec 的語意裡，所以走第二條路線。設計目標是讓 Roadmap 在這三條路線上長得和 Archived 一樣，不另起新形狀。

模擬畫面：開發期間放在 scratchpad 的 `roadmap-mock/template.html`，以 TCERT 真實資料產生。它是本設計的視覺參考，也驗證過分組、開頭段拆分、引用解析規則在 18 個真實檔上的結果：
- 分組：進行中 1、卡著 3、可挑 13、其他 1；
- 撞名：4 個名字、11 次出現，全部指 spec。

## Goals / Non-Goals

**Goals:**
- 解析規則集中在一個純模組，兩種執行形態共用，可以對真實資料形狀寫單元測試。
- 檔案內容不變，一切重排都發生在顯示層。
- 讀取範圍固定、由系統自行列舉，不開「依呼叫端給定的檔名讀檔」的通道。

**Non-Goals:**
- 不做檔案變動監看；app-settings「套用後的資料重載範圍」不需擴充，Roadmap 本來就不吃 CLI。
- 不做返回導覽、不調整引用旁目標頁提示的密度。
- 不引入 git、不讀檔案建立時刻。
- 不處理 srun:roadmap 寫法本身的問題：表格塞長文、前置欄寫長句、過期檔。那些屬 specrun。

## Decisions

### D1. 一次讀回整份清單＋全文，不分清單與詳情兩支通道

Roadmap 只有一支讀取通道 `listRoadmap()`，回傳以下內容：
- 每個 `.md` 檔的檔名、全文、修改時刻；
- `roadmap/` 目錄與 `roadmap.off` 是否存在；
- 引用解析用的名稱清單（見 D3）。

面板直接用清單裡的全文。面板的刷新控制就是重跑這支通道。

- **理由**：
  - 分組需要全文的段落標題，副行需要拆分表與關係欄，所以清單本來就得讀全文，另開詳情通道只會重讀一次。
  - 規模小：TCERT 18 檔約 30KB。
  - 少一支「依檔名讀檔」的通道，就不存在路徑逸出的攻擊面。spec 的「讀取範圍」寫死了這一點。
- **替代方案**：比照 Archived 開清單＋詳情兩支。Archived 那樣做，是因為詳情要讀多個 artifact、清單只需 tasks 進度；Roadmap 沒有這個落差。

### D2. 解析全放在共用純模組 `src/api/normalize-roadmap.ts`

IO 層只造 probe：`{ targetPath, dirExists, offExists, files: [{ name, content | readError, mtime }], refs, failure? }`。

以下都在共用模組裡完成：
- 解析標題行（狀態字取最後一段連續兩個以上空白之後的文字）；
- 四組分類；
- Next 範圍、Needs 前置、屬於的父項；
- 錯誤分類，沿用 `normalize-archived` 的 `not-openspec-project`／`read-failed` 分層。

顯示時才需要的「切段」也放同一個模組，輸出 `{ lead, relations[], split, rest }` 四塊 Markdown 字串：
- 開頭段拆成導言與關係欄；
- 抽出 `## 拆分與進度`；
- 其餘段落照原順序。

- **理由**：
  - 兩種形態的差異只剩 IO，行為不會分歧。
  - 格式容忍度（標題行空白、全半形冒號、欄名長度）都集中在一處，可以用 TCERT 形狀的 fixture 測。
- **替代方案**：在 Nitro route 內解析。這樣桌面形態得再寫一份，違反既有分工。

### D3. 引用名稱清單走檔案層列舉，含 parked

`refs` 由 IO 層列舉四個來源，只取名稱：
- `openspec/specs/` 的子目錄名；
- `openspec/changes/` 的子目錄名（排除 `archive`）；
- `openspec/changes/archive/` 的子目錄名；
- parked 名稱，沿用兩形態既有的 `listParkedNames`。

- **理由**：
  - spec 要求 CLI 不可用時 Roadmap 照常運作。改用 Changes store 已載入的清單，CLI 壞掉時 change 連結會靜默消失。
  - 用 Specs store 則要先進過 Specs 頁才有資料。
- **替代方案**：前端從既有 store 拼湊。上述兩個失效情境都會讓連結「看起來對不到」，而使用者分不出原因。

### D4. 引用與狀態圖示在 markdown-it 規則層處理，不做 DOM 後處理

`renderMarkdown` 增加可選的 roadmap 渲染選項，透過 markdown-it 的 `env` 傳入兩樣東西：
- **引用解析函式**：把 `code_inline` 規則換成先問解析函式。
  - 對得到：輸出 `<button type="button" class="md-ref" data-ref-kind data-ref-target>` 包住 `<code>`，跨頁的另附目標頁提示；
  - 對不到：走原本的輸出。
  - `fence` 與 `code_block` 不經過這條規則，自然不會被轉成連結。
- **「拆分表模式」旗標**：只在渲染 `split` 那一塊時開。它在 core rule 走 table token，找出表頭為「狀態」的欄，把該欄 inline 內容對照三個固定值，換成圖示 span，並在 `tr` 加上列狀態 class。

- **理由**：
  - 維持 `html: false` 的單一 escape 出口。在 v-html 前對 HTML 字串做替換，容易出 escape 漏洞。
  - 規則層拿得到 token 的語意（是不是 code block、在哪一欄），DOM 後處理得反推。
- 點擊由 MarkdownView 既有的委派 click 接住：命中 `.md-ref` 時 emit `ref` 事件，交給 Roadmap store。`.md-ref` 用 `<button>`，所以鍵盤可達。這不牴觸 artifact-view「相對路徑連結不可互動」：那條管的是 Markdown 連結語法，這裡是行內 code。
- 圖示與新 class 的樣式寫在 `src/styles/markdown.css`。v-html 產物吃不到 utility，這是既有慣例。圖示用內嵌 SVG path，不依賴 UnoCSS 的 icon class 被掃到。

### D5. 跨頁開啟：view store 帶一個待開目標，各頁 store 載入後自行消化

`useViewStore` 增加以下兩項：
- `pendingOpen: { view, id } | null`；
- `openOn(view, id)`：先設 `pendingOpen`，再走既有的 `show(view)`。切頁即關的語意因此不變。

各頁怎麼消化 `pendingOpen`：

| 頁 | 時機 | 找到時 | 找不到時 |
|----|------|--------|----------|
| Specs、Archived | `enter()` 載入完成後 | 開啟 | toast，照 spec |
| Changes | 清單常駐、不隨進頁重載，切頁當下直接查 active＋parked 清單 | `detail.show()` | toast，照 spec |

三頁消化後都清空 `pendingOpen`。

- **理由**：
  - 維持 view store 為換頁唯一入口。
  - 各頁「何時算載入完成」只有各頁自己知道，交給它們消化比由 Roadmap 輪詢乾淨。
- **替代方案**：Roadmap 直接呼叫三個 store 的開啟方法。Specs、Archived 的 `enter()` 會 reset 清掉開啟狀態，時序會打架。

### D6. Roadmap store 生命週期比照 archived store

- `enter()`：reset 後 load；
- 序號作廢過期回應；
- `firstLoadPending` 控制 skeleton；
- `openFile` 控制面板；
- 不留快取、沒有寫入面。

鍵盤分派在 `App.vue` 的 `move()`／`panelOpen` 加一支。↑↓ 的順序是「分組後攤平的清單」，由 store 以 computed 提供，與畫面順序同源。

### D7. 修改時刻取 mtime，不取 birthtime

- web：`fs.stat` 的 `mtimeMs`；
- 桌面：fs plugin `stat` 的 `mtime`。

實測 TCERT 6 檔的 birthtime 皆等於 mtime，比 git 首次加入時間晚了 1 天到 1 個月。AI 與編輯器存檔會替換檔案，所以 birthtime 不可靠。change 的建立時刻讀的是目錄的 birthtime，不受這個影響，因此兩邊不同是合理的。

### D8. 麵包屑與頁型別

- `AppView` 加入 `'roadmap'`；
- 麵包屑下拉的頁清單依序為 Changes／Specs／Archived／Roadmap；
- Roadmap 的數量來自 roadmap store 的 `count`，即規劃檔總數。

### D9. App 依賴 srun:roadmap 的哪些寫法

規劃檔的格式由 specrun 的 srun:roadmap skill 規定，App 只讀不寫。下表列出 App 認得的寫法。skill 在這些地方新增、刪減或改名時，App 要照最右欄跟著調；不在表內的改動（例如新增關係欄的欄名、調整段落在檔案裡的先後）App 不需要改。

| skill 規定的寫法 | App 拿它做什麼 | 程式位置 | skill 改了之後 App 要調什麼 |
|---|---|---|---|
| 標題行 `# 名稱` ＋ 兩個以上空白 ＋ 狀態字（空／`卡著`／`N/M`） | 分成 In progress／Blocked／Available，其餘歸 Other | `normalize-roadmap.ts` 的標題行解析與分組 | 新增狀態字：決定它歸哪一組，否則會掉進 Other。刪掉狀態字：移除對應分組條件 |
| 四個段落標題：`開始的條件`、`拆分與進度`、`動工前必知`、`已否決的做法` | 狀態字為空時，至少含其中一個才算 Available；否則歸 Other | `normalize-roadmap.ts` 的 `REQUIRED_SECTIONS` | **新增段落**：加進清單，只寫新段落的單段項才不會被誤判為 Other。**刪減或改名段落**：從清單移除或改名，並同步 spec 的 Available 判斷條件 |
| `## 拆分與進度` 這個段落標題 | 面板把這段提到開頭段之後；卡片抓「Next: 範圍」；狀態圖示只套用在這段 | `normalize-roadmap.ts` 的切段（`splitRoadmapSections`）與 `extractNext` | 改名：兩處一起改，否則拆分表不提前、卡片沒有 Next、狀態欄不換圖示 |
| 拆分表的「範圍」「狀態」兩欄名 | 「範圍」給卡片 Next 用；「狀態」決定哪一欄換圖示 | `normalize-roadmap.ts` 的 `extractNext`、`render.ts` 的拆分表模式 | 改欄名：兩處一起改 |
| 拆分表狀態欄的 `✅`、`⬅ 接下來` | 換成完成、接下來圖示；`⬅` 那列給卡片 Next 用 | `render.ts` 的 `STATUS_ICONS` | 新增狀態值：加一組圖示，否則照原文顯示（不會壞，只是沒有圖示）。改掉 `⬅`：Next 擷取一起改 |
| 關係欄 `- **欄名**：內容` 的行形 | 開頭段拆出關係欄小框 | `normalize-roadmap.ts` 的開頭段拆分 | 欄名不限清單，新增欄位不用改；改行形（例如不再用粗體）才要改 |
| 關係欄 `前置`、`屬於` 兩個欄名 | 卡片顯示「Needs: …」、「part of …」 | `normalize-roadmap.ts` 的 `needsRaw`、`parentRaw` | 改名：跟著改，否則卡片少掉這兩行 |
| `openspec/roadmap/` 目錄、`openspec/roadmap.off` 空檔 | 判斷要不要讀、三種空狀態選哪一種 | `server/api/roadmap.get.ts`、`src/api/desktop/roadmap.ts` 的 `OFF_FILE` | 改路徑或檔名：兩種執行形態一起改 |

App 比 skill 寬鬆的地方，skill 那邊不必配合：
- 拆分表狀態欄寫 `卡著` 也換成鎖的圖示，雖然 skill 沒規定這個值。
- 段落在檔案裡的先後不影響顯示。拆分與進度一律提到最前，其餘照原檔順序。

- **理由**：兩邊分屬不同 repo，skill 改格式時 App 不會收到任何提醒。先把依賴點列清楚，改的時候才知道要動哪幾處、會影響哪種畫面。

## Risks / Trade-offs

- **[寫法漂移]** 規劃檔是 AI 寫的自由格式，標題行空白數、冒號全半形、欄名都可能變。
  → 解析規則寬鬆，未命中一律退到 Other 或照原文，不丟錯。fixture 取自 TCERT 的真實邊界案例：總覽檔、過期檔、行內 code 標題、非規定欄名。
- **[kebab 名誤成連結]** 程式識別字剛好與 spec 或 change 同名時，會被連過去。
  → 只有目標真的存在才成連結，而且撞名時優先規格。TCERT 實測 34 個 kebab 名中，30 個對得到，對得到的都是正確目標。
- **[大量規劃檔]** 一次讀回全文，檔數上百時首載變慢。
  → 規劃檔依規定是暫存區、會被清掉，規模有上限。真的出現時再拆詳情通道，這不影響 spec。
- **[parked 名稱來源]** parked 存在 `.git/specrun-app/`，專案不是 git repo 時沒有 parked。
  → 列舉失敗視同空清單，不影響其他名稱。
- **[跨頁跳轉後目標消失]** 例如跳轉途中剛好被封存。
  → spec 已定：停在目標頁清單並 toast，不開空面板。

## Migration Plan

純新增頁面，無資料遷移。回滾就是移除 Roadmap 頁與下拉項，既有三頁行為不變。唯一的共用改動是 `renderMarkdown` 的可選參數與 MarkdownView 的 `ref` 事件，不傳時行為與現況相同。
