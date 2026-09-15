> 本 change 的範圍是排除法定出來的，開工時現掃，不照固定名單做。
> 行號會隨著前面的刪除而位移，用引號裡的原文定位。

## 1. 前置確認

- [x] 1.1 確認 `make-comments-self-contained` 已完成並通過人工驗收。驗證：該 change 的 `tasks.md` 全數勾選
- [x] 1.2 重跑丙類掃描 `grep -rnoE "(design D[0-9–、／/]+|spec [a-z-]{4,})( 的|：|\s+實測|\s+定案)" src/`。驗證：結果為空；非空就停下來問人，代表前一個 change 沒清乾淨，不可往下做
- [x] 1.3 確認工作區乾淨（`git status --short` 為空），避免與 `add-orb-logo` 或其他進行中的改動互相覆蓋
- [x] 1.4 產出本次工作清單：`grep -rnE "design D[0-9]|spec [a-z-]{4,}" src/` 全量輸出，逐條標記屬於甲-1（整括號刪）、甲-2（括號要拆）或代號類。驗證：清單條數與 grep 輸出行數一致，每條都有分類

　　**CRITICAL 更正（獨立稽核抓到）**：上面這條 regex 的 `[a-z-]{4,}` 只認小寫英文，只抓得到 `（spec artifact-view …）` 這種 capability 寫英文的，抓不到直接寫中文 requirement 名的，例如 `（spec 徽章弱一致）`、`（design 風險欄的競態）`。這批從頭到尾沒進過任何判定清單——不是「前一輪判定後決定保留」。改用不預設語言的掃描：`grep -rnoE "（(spec|design)[^）]*）|(spec|design)[：:]" src/`，扣掉 5 筆測試檔的 YAML 樣板字串（`normalize.test.ts:181`、`normalize-detail.test.ts:38/80/100/110` 的 `spec:`／`design:`，那是測試資料不是註解），新增 55 筆逐條核對：53 筆是註解內的引用，已依 2.3 判準處理；1 筆（`components/ArtifactPanel.vue:181` 的「（specs）」）是誤判，不是引用；1 筆（`utils/orb-color.test.ts:38` 的 `it()` 測試名稱字串）雖是引用，但字串字面值不落在註解內（見 5.4 判準補充），依非目標「純註解改動」不屬本 change 範圍，維持原字串不動。全 change 實際處理的引用總數因此是 181（舊 regex）＋53（新 regex 補上、扣掉誤判與非註解那 1 筆）＝234 處，不是最初估計的約 200 處。

　　**CRITICAL 更正 2（第 2 輪 review 抓到）：掃描法改成不依賴關鍵字的反查，兩條 regex 都退役。**

　　前兩條 regex 各自的盲區，寫在這裡給下一個人：

| 用過的掃描 | 它的盲區 | 實際漏掉什麼 |
|------------|----------|--------------|
| `grep -rnE "design D[0-9]\|spec [a-z-]{4,}" src/` | `[a-z-]{4,}` 只認小寫英文，capability 名寫中文就抓不到 | `（spec 徽章弱一致）` 這類中文 requirement 名，55 處 |
| `grep -rnoE "（(spec\|design)[^）]*）\|(spec\|design)[：:]" src/` | 假設關鍵字一定在 capability 名前面且緊接括號或冒號 | 括號在關鍵字後面的（`spec（park-mechanism 降級）要求…`）；根本沒有 `spec`／`design` 關鍵字的（`…是 artifact-view 的規定`） |

　　兩條的共同病根是同一個：**掃描本身有盲區，「結果為空」卻被當成綠燈**。改用反查法——不猜引用長什麼樣，而是拿 `openspec/specs/` 底下實際存在的 capability 名回頭搜 `src/`：

```bash
for c in $(ls openspec/specs/); do grep -rn -- "$c" src/; done
```

　　反查法第 2 輪找到 4 處註解類漏網（其餘命中都是測試 fixture 裡的路徑字串如 `'specs/change-list/spec.md'`，是測試資料不動），逐條處理如下：

| 位置 | 改前 | 改後 | 理由 |
|------|------|------|------|
| `utils/park-copy.ts` | `spec（park-mechanism 降級）要求不同途徑陳述同一個原因，兩處各寫一份遲早分岔。` | `不同途徑陳述同一個原因，兩處各寫一份遲早分岔。` | proposal.md 第四種「寫在句中」形態。`spec` 是句子主語，整括號刪會留下「spec 要求…」仍是出處，所以連 `spec（…）要求` 一起刪，保留句子的實質主張（兩處各寫一份遲早分岔）。比照 `api/types.ts:25` 的人工裁定精神 |
| `styles/tokens.css` | `…不變暗也不被攔截」是 artifact-view 的規定，不受本例外影響。` | `…不變暗也不被攔截」，不受本例外影響。` | 引號裡是 PanelShell 的實際樣貌，要留；「是 artifact-view 的規定」是出處歸屬，刪。**一致性**：同一條規定在 `PanelShell.vue`（`（spec artifact-view 無遮罩）`）本次已整刪，這裡留著就是一處刪一處留 |
| `components/ArchivedPanel.vue` | `<!-- 唯讀渲染規範沿用 artifact-view：同一個 MarkdownView，不開 interactive -->` | `<!-- 唯讀渲染：同一個 MarkdownView，不開 interactive -->` | 冒號後面已把實際做法講完，「規範沿用 artifact-view」是出處歸屬 |
| `components/SpecPanel.vue` | 同上（原文相同） | 同上 | 與 `ArchivedPanel.vue` 同進同退。`SpecPanel.vue` 本次原本整檔零 diff、`ArchivedPanel.vue` 改過別行卻漏了這行，兩者都是漏看不是裁定 |

　　注意：`styles/tokens.css` 這處**不在** 5.1 的人工裁定範圍內——該裁定只涵蓋同檔開頭指向 `docs/ui-structure-decisions.md` 的那一行，不涵蓋這一行。

　　加上這 4 處，全 change 實際處理的引用總數是 234＋4＝238 處。

　　**CRITICAL 更正 3（第 3 輪 review 抓到，最後一處）：`stores/changes.ts` 的跨行括號。**

　　改前（`main` 原樣，本 change 前兩輪都沒碰到）：

```
      // 對徽章而言這正是「取不到真實數字」（CLI 失敗／非 openspec 專案，spec 驗收：
      // 取數失敗不編數字）——不能讓這次落地被 projects store 讀成 0，watch 端靠
      // blockingError 分辨，這裡不必額外傳值
```

　　改後：

```
      // 對徽章而言這正是「取不到真實數字」（CLI 失敗／非 openspec 專案）——不能讓這次落地被
      // projects store 讀成 0，watch 端靠 blockingError 分辨，這裡不必額外傳值
```

　　`取數失敗不編數字` 是 `openspec/specs/project-management/spec.md:108` 的 `#### Scenario:`，依 2.3 新判準是出處名。括號與括號裡的真內容「CLI 失敗／非 openspec 專案」留著，刪掉的是 `，spec 驗收：` 到 `取數失敗不編數字` 為止。**一致性**：同一條 Scenario 在 `stores/projects.ts` 本輪已刪，這裡留著就是一處刪一處留。

　　**這一處為什麼三把鑰匙前兩把都抓不到——三種盲區疊在一起**：

| 掃描方式 | 為什麼漏掉這一處 |
|----------|------------------|
| 舊 regex A `spec [a-z-]{4,}` | 「spec 驗收」的「驗收」是中文，`[a-z-]` 不認 |
| 舊 regex B `（(spec\|design)[^）]*）` | 逐行比對，而這個括號**跨兩行**——起始行沒有右括號，`[^）]*）` 匹配不到 |
| capability 名反查（更正 2） | 整句沒提 `project-management`，它**直接點名一條 Scenario**，結構上看不到 capability 名 |

　　結論：前兩把鑰匙都假設「引用長什麼樣」，第三把假設「引用會提到 capability 名」。真正不依賴這些假設的是**從 spec 那端窮舉標題**回頭搜——見 5.1。

　　全 change 實際處理的引用總數是 238＋1＝**239 處**。

## 2. 甲-2：括號要拆的 40 處（先做，風險最高）

依 design.md E3 的三種形狀處理。這一章每一條都要人工核對，不可批次取代。

- [x] 2.1 處理「出處跟在真內容後面」的——例 `（與 normalize 同一個方向，design D1）`→`（與 normalize 同一個方向）`、`（--sr-overlay，design D8）`、`（tokens.css 既有例外的適用，不是新增例外，design D6）`、`（`--spacing` 一級 ＝ 3.5px，design D9）`。驗證：每一處括號仍在、真內容一字不少，只少了出處與它前面的頓號
- [x] 2.2 處理「出處跟程式碼引用並列」的——已知 `BrandMark.vue`「（design D3、orb-color.test.ts）」→「（見 orb-color.test.ts）」。驗證：改寫後仍指得到 `orb-color.test.ts`，程式碼引用沒被一起刪掉
- [x] 2.3 處理「出處後面接冒號展開」的。**判準對正（獨立稽核發現原判準與 proposal.md 牴觸，已改回）**：proposal.md 明寫出處形態之一是 `（spec <capability>「要求標題」）`——requirement 名算在出處裡，不是真內容。判準改成：

  | 形態 | 例 | 處理 |
  |------|-----|------|
  | 沒冒號，括號裡是 capability／requirement 名 | `（spec 徽章弱一致）`、`（spec「記號不可互動」）`、`（design 風險欄的競態）` | 整括號刪，標點留著 |
  | 有冒號，冒號後是展開的理由 | `（design：不引入 vue-router）`、`（spec 驗收：取數失敗不編數字）` | 刪 `spec`／`design` 與冒號前的 capability 名（含冒號），留冒號後的內容 |

  對應 design.md E3 表格第三列。驗證：沒冒號的括號一個不留；有冒號的只留冒號後的理由

  **判準改版（第 2 輪 review：改成可查證的形式）**：上表用「有沒有冒號」這個字面標記判斷括號裡剩下的是理由還是名稱，結果 3 處 Scenario 名因為原文剛好帶冒號就逃過了。冒號只是常見寫法，不是判準本身。判準改成拿得去查的版本：

  > 刪掉 `spec`／`design` 之後，括號裡剩下的字串拿去 `grep -rn "<字串>" openspec/specs/`——
  > 搜得到同名的 `### Requirement:` 或 `#### Scenario:` 標題 → 那是出處名，**整括號刪**；
  > 搜不到（或只在內文出現、不是標題）→ 那是理由，**留下**。

  依新判準重掃本次 diff 的所有括號殘留（34 個括號內容逐一查證），命中標題的 3 處全部改為整刪：

  | 位置 | 改前 | 改後 | 查證到的標題 |
  |------|------|------|--------------|
  | `stores/view.ts` | `切頁即關詳情、不記憶（切頁即關）。` | `切頁即關詳情、不記憶。` | `specs-view/spec.md:50`、`archived-view/spec.md:73` 的 `### Requirement: 切頁即關與重新載入`（同一引用在 `stores/specs.ts`、`stores/archived.ts` 已整刪） |
  | `stores/projects.ts` | `編造成「0 個 change」（取數失敗不編數字）。` | `編造成「0 個 change」。` | `project-management/spec.md:108` 的 `#### Scenario: 取數失敗不編數字` |
  | `components/ChangeList.vue` | `…都不推動任何卡片\n * （標示不造成版面位移）。框線用 line 而非 accent…` | `…都不推動任何卡片。\n * 框線用 line 而非 accent…` | `change-list/spec.md:152` 的 `#### Scenario: 標示不造成版面位移`（刪後句號跑到續行行首，比照 3.3 WARNING 的處理併回上一行行尾） |

  另外 1 處依新判準的**實質**改判：`api/types.ts` 的 `（薄殼）`（原 `（design：薄殼）`，舊判準當成「冒號後的理由」而留下）。`薄殼` 搜遍 `openspec/specs/` 找不到——它出自 `openspec/changes/archive/2026-08-17-add-specs-view/design.md:24`，是設計原則的**名字**不是理由，且屬 `~/.claude/CLAUDE.md`「用詞：字面即義」第 1 類比喻詞，少了 `design：` 前綴之後讀的人更不知道在講什麼。句子本身「`content` 是 CLI 原樣吐出的 Markdown，App 不解析」已經把話講完。處理：整括號刪。

  **第 3 輪再依同一實質改判 1 處**：`components/ChangeList.vue` 的 `（併入既有 header 行）`（原 `（design：併入既有 header 行）`，同樣因「有冒號」被舊判準留下）。查證：`grep -rn "併入既有 header 行" openspec/specs/` 為空，它出自 `openspec/changes/archive/2026-08-18-move-page-nav-to-breadcrumb/design.md:26` 的 `### 麵包屑併入既有 header 行，而非另闢一行`——是一條決策的**標題**，不是理由，與 `（薄殼）` 同形。處理：整括號刪，結果 `與下方的 Parked 對稱 -->`，句子本身（「Active (n)」回到群組標題位、與 Parked 對稱）資訊不減。

  重掃結果：除上述 5 處，其餘括號殘留在 `openspec/specs/` 都搜不到同名標題（只有「原生 dialog」「Park／Restore」「非預設 schema」等在內文出現的一般用語），確認全部是理由或程式碼引用，維持保留。

  **判準例外 1（人工裁定，維持不算違規）**：`components/SettingsModal.vue:139` 原句「（design D8／D9——驗證即套用，沒有未儲存狀態可弄丟）」用破折號「——」不是冒號，字面上不符表格。裁定：判準表的實質是「括號裡剩下的是一整句展開的理由就留、是 capability／requirement 名的短標籤就刪」，冒號只是最常見的標記寫法，不是判準本身；破折號在這裡功能等同冒號，維持「（驗證即套用，沒有未儲存狀態可弄丟）」的處理，不改回整刪。
  **判準例外 2（人工裁定，維持不算違規）**：`api/types.ts:25`、`utils/task-line.test.ts:4` 是「句中無括號」形態（proposal.md 的第四種出處形態），不適用本表——本表「沒冒號整刪」針對的是**括號形態**，括號是可以整塊移除的附加語邊界，整刪才安全。這兩處的引號標題（「錯誤分類」「僅翻轉勾選標記」）是句子文法主幹的賓語／定語成分，沒有括號那個邊界，整刪會斷句（「對應與 UI 的三層呈現」「——的落點」）。裁定：維持「只刪 `spec <capability>` 標記本身、保留引號標題」的做法，不比照括號形態整刪。
- [x] 2.4 覆核這批的 `git diff`。驗證：每一對增刪行的差異只有出處字串（與有冒號時的冒號本身），沒有任何真內容被刪掉

　　實際核對後，真正屬於「括號要拆／留冒號後內容」的有 26 處（**判準改版後為 21 處**——第 2 輪 `stores/view.ts`、`stores/projects.ts`、`components/ChangeList.vue:72`、`api/types.ts` 這 4 處，加上第 3 輪 `components/ChangeList.vue:164`，共 5 處經新判準查證為出處名，改判成整刪，移出本類併入甲-1，見 2.3「判準改版」）：design.md E3 表格前兩列（真內容在前、或跟程式碼引用並列）11 處括號形態＋3 處句中無括號形態，共 14 處；新掃描（見 1.4 更正）裡「有冒號」的 12 處（`utils/orb-color.test.ts:38` 因不落在註解內已排除，見 1.4／5.4）。40 這個數字是 design.md 動筆時的估計值，且原本把「沒冒號的 spec/design + 描述文字」也算進拆解，經判準對正後這批全部改為整刪（甲-1），詳見報告「規格缺口」段與 WARNING 修復記錄。

## 3. 甲-1：整括號刪除的其餘約 160 處

- [x] 3.1 依 1.4 的清單逐檔刪除句尾出處，密度最高的先做：`api/types.ts`、`stores/detail.ts`、`api/normalize.ts`、`components/ChangeCard.vue`、`components/ChangeList.vue`、`components/SettingsModal.vue`、`components/ArtifactTabs.vue`。驗證：這七個檔跑 `grep -nE "design D[0-9]|spec [a-z-]{4,}"` 結果為空
- [x] 3.2 處理其餘檔案。驗證：`grep -rnE "design D[0-9]|spec [a-z-]{4,}" src/` 全 repo 結果為空

　　**CRITICAL 更正**：這條驗證指令本身語言不中立（只認小寫英文），通過不代表乾淨。補跑不預設語言的版本 `grep -rnoE "（(spec|design)[^）]*）|(spec|design)[：:]" src/`，找出 55 筆中文 requirement 名的漏網之魚（扣掉 5 筆測試 YAML 樣板），其中 53 筆逐條併入本章處理（沒冒號的整刪，有冒號的依 2.3 判準留冒號後內容），1 筆（`ArtifactPanel.vue:181` 的「（specs）」）是 artifact 類型名不是引用、誤判不動，1 筆（`orb-color.test.ts:38` 的 `it()` 名稱字串）是引用但不在註解內、依 5.4 判準不屬本 change 範圍、維持原字串。兩條掃描現在都跑過且都乾淨。

　　**再更正（第 2 輪）**：「兩條掃描都乾淨」同樣不等於乾淨——第二條 regex 自己也有盲區，又漏了 4 處。判乾淨的依據已改成 1.4 CRITICAL 更正 2 的反查法，兩條 regex 降級為回歸檢查。
- [x] 3.3 刪除後的標點檢查。驗證：對改動檔搜尋行尾孤立標點與連續標點（`、）`、`（）`、`：）`、`。。` 等），無命中

　　**WARNING 修復**：原本的檢查只找「行尾」孤立標點，漏掉「跨行刪除後標點跑到續行行首」這種形態（`ChangeCard.vue` 曾出現行首句號、`stores/view.ts:11` 曾出現行首全形逗號，均已修正，逗號併回上一行行尾）。已補強為 `git diff main -- src/ | grep -nE "^\+\s*[。、，：；）]"`，本輪結果為空
- [x] 3.4 刪完逐檔快讀一遍，確認沒有句子因為少了出處而讀不通。驗證：讀不通的處數記錄下來；若有，該處退回 `make-comments-self-contained` 的乙丙判準處理，不在本 change 順手重寫（依 design.md E2）

　　讀不通的處數：0（原本會讀不通的 2 處——`api/types.ts:25`、`utils/task-line.test.ts:4`——都是句中無括號引用，人工裁定為判準例外，見 2.3 下方「判準例外 2」，不必退回前一個 change）。

## 4. 代號改寫的 14 處

依 design.md E4：換成它實際指的事，不留代號、也不改成新的文件引用。

- [x] 4.1 `M4 Tauri 版` 八處改寫——`api/normalize.ts`、`api/normalize-parked.ts`、`api/normalize-archived.ts`、`api/task-progress.ts`、`api/why-summary.ts`、`api/types.ts` 三處。驗證：八處都不含 `M4`，且仍說得出「這是純函式，web 與日後的 Tauri 版共用」
- [x] 4.2 `api/gateway.ts` 的 `T1`／`T2` 兩處改寫成「目前恆走 web／日後依執行環境分流」的白話。驗證：不含 `T1`、`T2`，且讀得出現在與日後的差別
- [x] 4.3 `components/ArtifactPanel.vue`「M3 才填」、`markdown/markdown-it-task-lists.d.ts`「勾選是 C4」、`components/ChangeCard.vue`「C3 watcher 進度補間時」三處改寫。驗證：三處都不含 `M`／`C` 代號

　　改前／改後對照（第 2 輪 review 要求補記，讓人工驗收清單看得到這行）：

| 檔案 | 改前 | 改後 |
|------|------|------|
| `markdown/markdown-it-task-lists.d.ts` | `/** true 才讓 checkbox 可勾；本 App 維持唯讀（勾選是 C4） */` | `/** true 才讓 checkbox 可勾；本 App 這個開關恆為 false，可勾選另有一條路徑實作 */` |

　　這行的改寫幅度超出「只刪不改寫」（E2）：`C4` 白話化時順帶把「本 App 維持唯讀」改成「這個開關恆為 false，可勾選另有一條路徑實作」。事實正確（可勾選走的是 `task-line.ts` 那條路徑，不經這個 plugin 開關），但屬於改寫不是刪除。第 2 輪 review 裁定**不再回頭改它**，只要把實際文字補進紀錄供人工驗收核對。

　　更正（人工裁定）：`ChangeCard.vue` 的 `C3` 改為純刪除，不做白話替換——`C3`／`C5` 指的是「這段 code 是哪一次改成現在這樣的」，是已經發生完的歷史；不像 `M4` 指的是還沒發生、讀 code 的人需要知道的事（日後會有 Tauri 版），白話化後才有東西可以講。`C3` 白話化只會變成一句指不到東西的話（例如「那次改動」——全 repo 沒有任何地方交代那是哪一次），所以改採 design.md E3 甲-1 的整段刪除處理，不留代號也不新增描述。結果：`C3 watcher 進度補間時` → `watcher 進度補間時`（句子主語維持原樣，是「用 scaleX 不用 width 這個決定」，不是某次改動）。`M3`／`C4` 的白話改寫不受影響，維持原判斷。
- [x] 4.4 `components/AppSidebar.vue`「三段結構依 docs/ui-structure-decisions.md；專案清單段自 C5 起」改寫——同時拿掉 `.md` 路徑與 `C5`。驗證：不含 `docs/` 與 `C5`

　　更正（人工裁定）：`C5` 同 4.3 的 `C3`，改為純刪除，不做白話替換，理由同上（歷史時間標記，白話化後指不到東西）。結果：`專案清單段自 C5 起是可互動的多專案清單` → `專案清單段是可互動的多專案清單`，「自 C5 起」整段拿掉，其餘（含「可互動的」）一字不動。`.md` 路徑仍照原計畫拿掉。
- [x] 4.5 `utils/orb-engine.ts`「見 openspec/changes/add-orb-logo/design.md D1」改寫。驗證：不含 `openspec/` 與 `design.md`

　　更正：這處括號裡沒有 M／C／T 代號，整個括號就是出處，實際歸類是甲-1（整括號刪、標點留著），不是代號改寫。已改成單純刪除：`（見 openspec/changes/add-orb-logo/design.md D1）` → 直接刪掉，冒號留著。

## 5. 收尾與驗收

- [x] 5.1 全 repo 掃描。**三把鑰匙全跑，以第三把為準。** 這一節是給下一個做同類清理的人的教訓：三把鑰匙各自漏過東西，各自的盲區寫在下面，不要只用其中一把就宣告乾淨。

  **鑰匙一：猜引用的字樣（最先用，最不可靠）**

```bash
grep -rnE "design D[0-9]|spec [a-z-]{4,}|openspec/changes|docs/ui-structure" src/
grep -rnoE "（(spec|design)[^）]*）|(spec|design)[：:]" src/
```

  盲區：第一條 `[a-z-]{4,}` 只認小寫英文，中文 requirement 名（`（spec 徽章弱一致）`）抓不到，漏 55 處。第二條假設關鍵字緊接括號或冒號、且**逐行比對**，所以漏掉括號在關鍵字後面的（`spec（park-mechanism 降級）要求…`）、沒有關鍵字的（`…是 artifact-view 的規定`）、以及**跨行的括號**（`stores/changes.ts` 那處起始行沒有右括號）。現在降級為回歸檢查，只用來確認舊寫法沒回頭長出來。

  **鑰匙二：拿 capability 名反查**

```bash
for c in $(ls openspec/specs/); do grep -rn -- "$c" src/; done
```

  盲區：只認得**提到 capability 名**的引用。直接點名一條 Requirement／Scenario 而不提 capability 的（`stores/changes.ts` 的「spec 驗收：取數失敗不編數字」）看不到。

  **鑰匙三：拿 spec 標題窮舉反查（主掃描，唯一不依賴「引用長什麼樣」的）**

```bash
# 取 openspec/specs/ 全部 Requirement／Scenario 標題當鑰匙（403 條），
# 比對前先把註解跨行接成整段——逐行 grep 看不到跨行括號
grep -rhE "^#+ (Requirement|Scenario):" openspec/specs/ | sed -E 's/^#+ (Requirement|Scenario): //' | sort -u
```

  它從 spec 那一端窮舉，不猜引用的寫法，所以前兩把的盲區它都沒有。**使用注意**：跑出來的命中大多是一般用語，不是引用——「讀取失敗」「切換專案」「CLI 不可用」「能力判定在伺服端」「空狀態」「載入中」這些詞本來就會出現在描述句裡。判斷方式是看同一段註解裡**有沒有 `spec`／`design`／`規格` 標記**；沒有標記的是一般用語，留著。比對時要注意 `openspec` 這個字本身含有 `spec`，標記判定要先把它剔掉，否則「非 openspec 專案」會整批誤判成引用。

  本輪結果：403 條鑰匙掃過全部 `src/` 追蹤檔，接成整段後命中且帶真標記的只剩 3 筆，逐條核對皆非引用——`api/types.ts:42` 的「specs 多檔串接時當標頭」是敘述句裡的普通名詞（多個 spec 檔），`stores/projects.ts:26` 的兩筆是同一段大註解，標記來自段內「（規格允許延遲到下次刷新才反映）」這句（見下方 (f) 類殘留），命中的「切換專案」「專案徽章」都是段內的一般用語。確認 `src/` 已無指向規格文件的引用。

　　實際結果非空，殘留全數核對為（a）程式碼字串／UI 文案，非註解，本 change 不動；（b）註解裡對「openspec/changes」這個實際目錄路徑、或 CLI 子指令（如 `openspec status`、`openspec list`）的平實敘述，不是指向規格文件的引用；（c）指向常駐規範文件的 2 處，**人工裁定的例外，不是漏刪**：`styles/tokens.css:4`——判準：指向 `docs/` 底下常駐存在的文件（不會像 change 的 `design.md` 那樣歸檔後找不到），且內容是「改值時要做的維護動作」而非單純出處標註，這種不在本次刪除範圍內。**同類第 2 處（第 3 輪補列，原清單漏了它）**：`components/SettingsModal.vue:95` 的 `焦點不得離開盒子（ui-interaction-states 的 modal 規範）`——指向的是常駐的 skill 規範（`ui-interaction-states`），性質與 `tokens.css:4` 相同，同樣保留；原先沒列進殘留清單，下一個人換掃描方式會再被它絆一次；（d）`components/ArtifactPanel.vue:181` 的「（specs）」是 artifact 類型名（程式碼自己的概念），不是規格文件引用，判斷為誤判不動；（e）`utils/orb-color.test.ts:38` 的 `it()` 測試名稱字串，是真的引用但字串字面值不落在註解內（依 5.4 判準），維持原字串不動，不屬本 change 範圍。不預設語言版本的掃描結果確認只剩 5 筆測試 YAML 樣板（`normalize.test.ts:181`、`normalize-detail.test.ts:38/80/100/110`）＋(d)(e) 這 2 筆不動的殘留，逐條清單見報告。

　　**殘留清單補兩類（第 2 輪 review：原清單漏列，下一個人重跑掃描會再被絆一次）**：

　　（f）**有 `spec`／`規格` 字樣但沒指到哪一條**的 4 處——它們一致地全部保留，處理沒錯，只是原清單沒列：

| 位置 | 原文 |
|------|------|
| `components/ChangeCard.vue` | `.stop 是 spec 要求——按這顆不能順便把詳情打開。` |
| `components/ChangeCard.vue` | `Why 摘錄：抽不到就整塊不渲染、不留佔位——卡片高度因此不一致是規格接受的行為。` |
| `markdown/task-consistency.test.ts` | `// 前端可點 ⊆ 伺服端認得：spec 要求的方向成立（反向多認的行點不到，寫不進去）` |
| `stores/projects.ts` | `非目前專案不受影響（規格允許延遲到下次刷新才反映）；` |

　　保留理由：這四處講的是「有規格這樣要求」這件事本身，沒有指向任何一份文件或一條 requirement，拿掉就變成無主張的句子。它們不是本 change 要刪的「出處」。

　　（g）**「句中無括號」形態的第三處**：`markdown/task-consistency.test.ts` 的 `「可勾選項的判定一致性」：畫面渲染成可互動 checkbox 的行，伺服端的 regex 必須認得。` 2.3 的「判準例外 2」只寫了 `api/types.ts`、`utils/task-line.test.ts` 兩個檔名，漏列這個。裁定相同：引號標題是句子文法主幹的主語，沒有括號那個可整塊移除的邊界，整刪會斷句，維持原樣不動。

- [x] 5.2 代號掃描。驗證：`grep -rnE "(^|[^A-Za-z0-9])(M[0-9]|C[0-9]|T[0-9])([^A-Za-z0-9]|$)" src/` 只剩 `styles/markdown.css` 的 SVG path 資料（非註解），無其他命中
- [x] 5.3 確認指向程式碼自己的引用一行未動。驗證：`git diff` 不含 `見 settleMove`、`依 projects.ts 慣例`、`機制見 interactions.css`、`見 OptimisticMove`、`見 ChangeList` 這些字串的刪除
- [x] 5.4 確認本次只動註解。驗證：`git diff` 的每一個新增／刪除行都落在註解內（`//`、`/* */`、`<!-- -->`），沒有任何可執行語句、變數名或格式變動

　　**判準補充（人工裁定）**：字串字面值不算註解，即使它是描述性的（例如 `it('...')` 的測試名稱字串）——它是會印在測試報告輸出上的可執行語句的一部分，不落在 `//`／`/* */`／`<!-- -->` 內。`utils/orb-color.test.ts:38` 的 `it()` 名稱字串曾一度被誤改，已改回原字串 `it('顏色由傳入的 surface/accent 決定，不寫死色票（spec：記號 MUST NOT 引入新色票）', () => {`，不在本 change 處理範圍內。
- [x] 5.5 跑 scoped lint（不帶 `--fix`）與全量測試。驗證：lint 無紅燈、測試全過
- [x] 5.6 產出人工驗收清單：只列第 2 章的 40 處與第 4 章的 14 處（第 3 章屬機械刪除，由 5.1 的掃描與 5.4 的 diff 檢查涵蓋，不逐條列）。驗證：清單 54 條齊全，每條並列改前與改後

　　**第 3 輪 review 後的實際條數**：21（拆解／留冒號後內容——原 26 扣掉改判成整刪的 5 處，見 2.3「判準改版」）＋14（代號改寫，其中 `C3`／`C5` 經人工裁定改為純刪除，變成 12 處白話改寫＋2 處刪除）＋5（反查法找到的「句中／跨行出處」刪除：更正 2 的 4 處＋更正 3 的 `stores/changes.ts`）＝**40 條**，另加 1 條**待使用者裁定**：`components/SettingsModal.vue` 的 `（design 標示為可微調的留白）` 整刪後，`PANEL_WIDTH = 620` 這個數字「可以調」的許可沒了，可能有實質資訊損失；維持整刪現況不自行改寫（改成「（數字可微調）」會違反 E2「只刪不改寫」），交使用者決定。合計 41 條。

　　（原記錄為 26＋14＝40 條，非 54 條；已在報告本文完整列出改前／改後對照，不虛報湊數。40／54 兩個數字都是 design.md／proposal.md 動筆時的估計值，經 CRITICAL 掃描修復與 WARNING 判準對正後，實際條數與估計值有出入，差異來源已如實記錄，不回頭改估計值本身（那是上位文件的數字，不歸這份 tasks.md 改）。）
