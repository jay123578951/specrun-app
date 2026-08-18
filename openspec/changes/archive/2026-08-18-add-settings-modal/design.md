## Context

動機見 proposal.md「Why」，行為契約見 `specs/app-settings/spec.md`、`specs/openspec-gateway/spec.md`、`specs/change-list/spec.md`。以下只記形塑做法的現況與約束。

- `server/utils/openspec-cli.ts` 的 `CLI_BIN` 是模組層常數 `'openspec'`，所有 route 經 `runCli()` 共用。該檔已留註解記下這個坑。
- `server/utils/app-config.ts` 的 `AppConfig` 目前兩欄（`projects`、`lastActivePath`），`parseConfig()` 逐欄位收斂、認不得的形狀一律丟掉，寫入走 temp + rename 原子替換。
- `src/App.vue` 的面板槽是單槽 `v-if / v-else-if` chain，三個分支各自綁一個頁；`onKeydown` 以 `if (!panelOpen.value) return` 開頭，Esc 依當前頁分流關閉對應面板。
- `src/styles/tokens.css` 全域禁用 `box-shadow`，唯一例外是浮層用的 `--sr-shadow-overlay`（現有使用者：ToastStack、`interactions.css` 的 dropdown）。
- `src/components/PanelShell.vue` 明文「無陰影、無 backdrop，露出區的清單不變暗也不被攔截」——這是 artifact-view 的規定，作用域僅限 slideover。
- `folder-picker.ts` 已示範本專案的平台能力模式：`canPickFolder()` 在伺服端判定，前端只讀 status 分流。
- `ChangeList.vue:114` 與 `SpecsView.vue:46` 各有一段 cli-unavailable 常駐 banner，文案目前指示「reachable on PATH, then refresh」。

## Goals / Non-Goals

**Goals:**

- CLI 執行檔的解析集中在一處，成為伺服端可於執行期更換的狀態，呼叫端零改動。
- Settings 以零耦合的方式疊加：不動面板槽、不動 `AppView` 聯集、不改任何既有頁的行為。
- 首次引入 modal 時把 modal 的通用行為（Esc 優先權、focus trap、focus 歸還、遮罩）一次做對，之後若有第二個 modal 可直接沿用。

**Non-Goals:**

- 不抽 modal 的共用元件庫。第一個 modal 就抽外殼是 rule of three 未到；PanelShell 是三處到齊才抽的先例。
- 不為 Tauri 形態預先分支。gateway 介面已是 M4 的替換點，本 change 只確保解析邏輯住在伺服端、不外洩到前端。
- 不改動 `openspec-gateway` 既有的錯誤分類語意，只改「CLI 不可用」成立的時機（解析全數失敗後才成立）。

## Decisions

### D1 — Settings 是 modal，不是頁也不是 slideover

依資訊量決定：內容為 1 組控制 ＋ 4 行唯讀，約 620×500，且有硬上限（非目標已鎖死主題／排序／間隔等所有會讓它長高的項目），**永不捲動**。頁與 slideover 都是「容器先決定尺寸」——兩者都吃滿視窗高，456px 的內容進去必然剩約半屏空白；modal 是「內容決定尺寸」，不可能填不滿。

考慮過的替代方案：

- **做成第四個頁**：頁的價值在於容納會隨資料無上限成長的內容（Specs、Archived 都是清單）。用它裝一個有硬上限的東西是為不存在的成長預留空間。且 Settings 是**專案無關**的，而現有三個頁全是專案內的視圖，讓「換頁」同時承載兩種語意。
- **做成第四個 slideover**：會撞上單槽 chain——使用者開著詳情時開 Settings，畫面上是詳情滑出、Settings 從同一邊滑入，關閉後還要決定要不要復原詳情。而且 slideover 的 320px 露出區是為「詳情在講某個 change、可直接點左邊切換」設計的，Settings 不講任何 change，露出區在它身上語意為空。
- **不做 Settings、把 CLI 路徑做成 cli-unavailable 空狀態的就地修復**：錯誤發生處即修復處確實好，但 Tier 2 的診斷資訊沒有家，且側欄的 Settings 死項會繼續掛著。最終採兩者並存——Settings 為常設入口，banner 提供捷徑（見 D7）。

### D2 — modal 不進面板槽，Settings 不進 `AppView` 聯集

Settings 疊在任何頁之上，與 `detail.isOpen` 完全無關，因此 `App.vue` 的 `v-if / v-else-if` chain 不新增分支。`view.ts` 那句「Settings 仍是死項，落地前不進這個聯集」的註解就地成真——它永遠不進聯集，改寫註解說明原因即可。

好處是零耦合：詳情開著也能疊 Settings，關掉就回到原狀（spec「Settings 為覆蓋層而非頁」的兩個 scenario 直接落在這個結構上）。側欄底部段（`mt-auto` ＋ 一條分隔線）與 nav 段的既有視覺分隔，正好承載「它的行為也不一樣」。

### D3 — CLI 解析三段降級：process PATH → login shell → 手動

`which` 在 GUI App 內是失效的：`.app` 從 Finder 啟動時 PATH 僅 `/usr/bin:/bin:/usr/sbin:/sbin`。三段依序為：

1. `execFile('openspec', ['--version'])` ——吃行程本身的 PATH。`pnpm dev` 形態下第一段就命中，開發期零額外成本。
2. `$SHELL -ilc 'command -v openspec'`（timeout 3s）——借使用者終端機的真實 PATH，取回絕對路徑。這是 GUI App 的標準解法。
3. 皆未命中 → 回報 CLI 不可用，引導手動指定。

考慮過的替代方案：**維護一份常見安裝位置清單**（`~/Library/pnpm`、`/opt/homebrew/bin`、`/usr/local/bin`、`~/.local/bin`、`~/.bun/bin`、npm global prefix…）。否決理由：這份清單要永久追著套件管理器生態跑，是沒有終點的維護債；而 login shell 已一次涵蓋所有「正確安裝」的情況。spec 因此明文 `MUST NOT 維護一份寫死的常見安裝位置清單`。

非 darwin 平台跳過第 2 段直接落到手動指定，比照 `canPickFolder()` 的平台能力判定模式——能力判定在伺服端，前端不寫死平台分支。

### D4 — 只持久化明示覆寫，不快取偵測結果

`config.json` 新增 `openspecBin: string | null`，`null` ＝ 自動偵測。偵測結果**不寫回**：它是機器環境的衍生物，寫回去就成了會過期的假資料（升級 openspec、換套件管理器即失效）。

由此也決定了**不分檔**。原本的疑慮是「CLI 路徑是機器環境、與專案清單這種使用者資料性質不同，換機器就錯」；但既然存的是使用者的**明示選擇**而非機器狀態，它本質就是使用者資料，放同一份 `config.json` 合理。換機器頂多路徑失效 → 驗證當場報錯 → 引導重設，降級路徑明確（spec「覆寫路徑已失效」scenario）。`parseConfig()` 沿用既有的逐欄位收斂紀律：形狀不符即丟掉該欄、降級為自動偵測。

### D5 — 手動指定用文字輸入，不擴 folder-picker

可編輯的 mono 輸入欄 ＋ 提示文案（在終端機跑 `which openspec` 取得路徑），**不做** `choose file`。理由：使用者取得這個路徑的實際方法就是終端機輸出後複製，貼上遠快於在 dialog 導航；且 openspec 幾乎都裝在隱藏目錄（`~/Library/pnpm`、`/opt/homebrew/bin`），macOS 原生 dialog 預設看不到這些，要按 `Cmd+Shift+.` 才顯示——原生 dialog 在這個特定場景反而難用。

這與 project-management 的「加入專案走原生 dialog」慣例並不衝突：**選專案是選使用者放在可見處的資料夾，選 CLI 是選隱藏系統路徑且來源本就是終端機輸出**。情境不同，結論才不同，不是推翻慣例。

### D6 — 單一「驗證並套用」，套用範圍比照 `projects.adopt()`

不設獨立的儲存鈕，消滅「已驗證但忘記存」的中間態（也就不必在 UI 上表達第三種狀態、不必在關閉時提醒未儲存）。`--version` 成功 → 寫 config → 重載；失敗 → config 不動、狀態列就地報錯（依 `projects.ts` 慣例：有專屬位置就地貼，沒有才 toast）。

重載範圍比照 `projects.ts` 的 `adopt()` 先例——換 CLI 的影響面至少等同換專案：`changes.invalidate()` ＋ `load()`、目前頁若為 specs 一併重載、背景 `refreshBadges()`。**archived 與 watcher 不動**：archived 走檔案層直讀、CLI 零參與（C9 定案）；watcher 監看的是檔案系統，與 CLI 無關。

成功後 modal **不自動關**，狀態列留著版本確認；使用者關掉就看到資料已經回來——這正是 D2 零耦合換來的好處（背後可以更新而不打斷確認）。

### D7 — cli-unavailable banner 補出口

`ChangeList.vue:114` 與 `SpecsView.vue:46` 的常駐 banner 現有文案「Make sure it is installed and reachable on PATH, then refresh」在本 change 之後即為**錯誤指引**——路徑已經可設定。兩處都改寫文案並加「Open settings」入口。這不是選擇而是必然後果：留著原文案等於指示使用者去做一件不再必要的事。

### D8 — 遮罩極輕壓暗，明文限定不擴及 slideover

`rgb(0 0 0 / 0.35)` ＋ `--sr-shadow-overlay` ＋ 1px 邊框，三者合力；點遮罩關閉。

考慮過**完全不壓暗、只攔點擊**（最貼合既有語言，零例外要寫）。否決理由是實際可讀性：深色主題下 modal 底色是 `--sr-surface` (#1a1f27)，背後的卡片也是 `--sr-surface`——同色；陰影在深底上本就吃虧，不壓暗的話邊界只剩那條 1px 線在撐。且透明遮罩會攔點擊卻不給訊號，使用者點下去的反應難以預期。也考慮過標準的 `0.55`，但這是一個九行內容、使用頻率極低的設定盒，壓那麼重會演成重大中斷，與 App 整體克制的視覺調性不合。

**適用範圍必須寫死**：這是 `tokens.css` 既有浮層例外（dropdown、toast）的延伸，Settings modal 是第三個浮層。**MUST NOT 擴及 slideover**——`PanelShell` 的「無遮罩、露出區不變暗」不受本決策影響。

### D9 — 點遮罩關閉的安全性由 D6 保證

一般 modal 忌諱點遮罩即關（怕弄丟未儲存輸入），但 D6 已消滅未儲存狀態：驗證即套用，套用即持久化。最壞情況只是使用者打到一半、尚未驗證的路徑消失，重貼一次的成本。因此點遮罩關閉可以放心採用。

### D10 — Esc 讓位而非堆疊

`App.vue` 的 `onKeydown` 目前 `if (!panelOpen.value) return`。Settings 開啟時若背後剛好也開著詳情，Esc 會穿透關掉詳情——這是必須擋掉的 bug。做法是全域 handler 在 modal 開啟時整個讓位（提早 return），Esc 只由 modal 自己處理。不做「堆疊式依序關閉」：本 App 只有這一層 modal，堆疊機制是為不存在的層數設計。

一併依 `ui-interaction-states` 的 modal 規範處理 focus trap 與關閉後 focus 歸還觸發鈕。

## Risks / Trade-offs

- **login shell spawn 可能被使用者的 rc 檔干擾**（互動式 shell 可能有輸出、可能很慢）→ 設 3s timeout，逾時視同未命中；只取 `command -v` 的輸出並取最後一行非空白內容，忽略其餘雜訊；解析出的路徑仍要通過 `--version` 驗證才採用。
- **`-ilc` 會執行使用者的 shell 設定檔**，屬於在使用者機器上跑他自己的 rc——與 `folder-picker` spawn `osascript` 同級的本機操作，但仍應只在第一段未命中時才進入，避免開發期每次啟動都付這個成本。
- **App 首次引入 modal，focus trap 容易做半套**（只擋 Tab、忘了 Shift+Tab 或初始焦點）→ 依 `ui-interaction-states` 的 modal 清單逐項落實，並在 tasks 拆出獨立驗收項。
- **診斷區的「開啟所在位置」是新的伺服端能力**，非 darwin 平台不可用 → 比照 P1 park 禁用先例：禁用 ＋ tooltip 說明原因，不隱藏（隱藏會讓使用者不知道有這個能力、也不知道為何沒有）。
- **`AppConfig` 加欄位會遇到舊設定檔**（既有使用者的 `config.json` 沒有 `openspecBin`）→ `parseConfig()` 既有紀律已涵蓋：欄位缺失或形狀不符即回預設值 `null`（自動偵測），無需 migration。
- **CLI 路徑換掉後，正在飛的請求可能以舊執行檔回應** → 沿用專案既有的世代／序號防護模式（`projects.ts` 的 `generation`、`changes.ts` 的 `loadSeq`），晚到的舊回應不得寫回狀態。

## Migration Plan

無資料遷移。`config.json` 新欄位由 `parseConfig()` 的既有降級行為向後相容，舊設定檔讀進來即為 `openspecBin: null`（自動偵測），行為與現況一致。

回滾即還原程式碼：`config.json` 中殘留的 `openspecBin` 欄位會被舊版 `parseConfig()` 忽略（逐欄位收斂只取認得的欄位），不會造成讀取失敗。

`ROADMAP.md` 需一併更新：Settings 自 M3 移出，改列為 M4 前置（理由見 proposal.md）。

## Open Questions

以下三項為**刻意留給實作者的留白**，不是遺漏——它們不影響 spec、不影響本文的做法選擇、也不改變 tasks 拆分，下游 MUST NOT 視為缺漏而自行補成決策，亦 MUST NOT 因未定而刪除相關工作：

- **modal 的確切寬度**：估算約 620px（由最長的 config.json 路徑字串決定），依實際排版微調。
- **進出場動畫的時值與曲線**：依 `ui-motion` skill 的固定值表取值，不另行決策。
- **狀態列三態的具體文案**（尚未驗證／成功／失敗）：spec 只要求三態可區分且失敗附可據以排除問題的訊息，用字由實作者定。
