# Design

## Context

動機見 proposal.md 的 Why。這裡只列會影響做法的現況。

**監看有兩份，行為要一致。** 瀏覽器形態是 `server/utils/change-watcher.ts`（Node 的 `fs.watch`），桌面形態是 `src/api/desktop/watch.ts`（外殼的監看通道）。兩份現在都是先試著遞迴監看 `openspec/changes/`；這個目錄不存在才退一層監看 `openspec/`，再用路徑過濾掉 `changes/` 以外的事件。兩份各自在 400 毫秒內把連續的事件合成一則通知。

**通知只有一個訂閱者。** `src/App.vue` 的 `syncFromWatcher` 收到通知後重新載入 Changes 清單，再重取開著的 change 詳情。Roadmap 沒有接上。

**Roadmap 的資料一趟取回。** `gateway.listRoadmap()` 一次回傳所有規劃檔的全文、各檔更新時刻，以及 specs／changes／archived／parked 四類名稱（用來判斷內文的引用能不能點）。清單和面板共用這一份，面板不另發請求。

**`roadmap` store 現在只有一顆序號。** `load()` 用 `listSeq` 同時做兩件事：丟掉過期的回應，以及在 `finally` 裡判斷要不要清掉 `refreshing`。`reset()` 也會遞增它。

**面板內文不會因為引用名稱改變而重繪。** `RoadmapPanel.vue` 交給 `MarkdownView` 的選項物件只依賴 `roadmap.resolveRef` 這個固定的函式參照。`MarkdownView` 只在內文字串或選項物件換掉時才重新渲染。所以名稱清單換了、內文沒換時，連結不會更新。

## Goals / Non-Goals

**Goals:**
- 兩種執行形態在同一組檔案變動下發出通知的時機一致
- 背景重新載入不干擾使用者自己按的刷新：不搶走它的進行中狀態，也不讓它卡在轉圈

**Non-Goals:**
- 不改通知的形式。仍然只說「有變動」，不帶路徑、不分來源
- 不為 Specs 頁、Archived 頁加監看
- 不監看 `openspec/specs/` 與 `.git`
- 不改 `GET /api/roadmap` 與桌面形態讀取規劃檔的內容

## Decisions

### D1：通知範圍是 `changes/` 底下、`roadmap/` 底下，以及 `roadmap.off`

`roadmap.off` 要算進去，因為它決定 Roadmap 頁顯示「此專案選擇不使用 roadmap」還是「尚無 roadmap」。

`roadmap/` 目錄一開始不存在時也要收得到之後的變動。現有程式對 `changes/` 已經有同樣的處理（退一層監看 `openspec/` 再過濾），照同一個方式涵蓋 `roadmap/`。

沒有採用的做法：把整個 `openspec/` 都算進通知範圍。這樣 spec 的修改、`config.yaml` 的修改都會觸發 Changes 清單重跑一次 CLI，而這些變動 Changes 頁和 Roadmap 頁都用不到。

### D2：通知維持不分來源

規劃檔的變動和 change 的變動發的是同一種通知。訂閱者收到後依「使用者現在在哪一頁」決定要重讀什麼。

理由：Roadmap 內文裡指向 change 的引用，能不能點取決於 change 存不存在。change 被建立或歸檔時 Roadmap 頁也需要重讀，分來源反而要多寫一條規則把它接回來。

沒有採用的做法：通知帶上來源（changes 或 roadmap）。gateway 規格明定通知不帶細節，兩個形態的通道都要跟著改，換來的只是少發一次請求。

### D3：`roadmap` store 新增背景重新載入，與 `load()` 分開

比照 `src/stores/changes.ts` 的 `loadSilently()`：

- 成功：換上新資料，清掉 `listError`。開著的規劃檔不在新清單裡就關閉面板（與 `load()` 相同的規則）
- 失敗：什麼都不做。不清空 `items`，不設 `listError`
- 全程不碰 `firstLoadPending` 與 `refreshing`

`load()` 在失敗時會清空清單並顯示錯誤狀態，這是使用者自己按刷新時該有的回饋，所以不能直接拿 `load()` 來用。

**要避開的問題：** 背景重新載入如果直接遞增 `listSeq`，飛在半路的 `load()` 回來後會發現序號不是自己的，`finally` 就不清 `refreshing`，刷新控制永遠轉圈。`changes.ts` 已經遇過這個問題，解法是把「丟掉過期回應」和「清進行中狀態」拆成兩顆序號，背景重新載入只動前者。這裡照做。

`reset()`（離頁、切專案）之後才回來的背景回應要丟掉，不能把已經清空的頁面又填回去。

### D4：`App.vue` 在使用者停在 Roadmap 頁時才觸發

`syncFromWatcher` 既有的兩步（重載 Changes 清單、同步開著的 change 詳情）不動，另外加一步：目前頁是 Roadmap 就呼叫 D3 的背景重新載入。不在 Roadmap 頁時不讀，進頁時 `enter()` 本來就會重新載入。

瀏覽器形態斷線重連後的補償通知也走同一條路，不需要另外處理。

### D5：名稱清單改變時，面板內文的連結要重新判斷

規格要求引用的 change 被建立後，面板裡那個名稱要變成可點的連結。依 Context 最後一段，現在的寫法做不到，需要讓面板的渲染在名稱清單內容改變時重跑一次。

同時要守住「內容沒有差異不重繪」：每次通知都會拿到一份新的名稱清單物件，內容相同時不能觸發重繪。做法由 Coder 決定，條件是兩個情境都要過：名稱清單有變就更新連結、沒變就不重繪。

### D6：清單的原地更新交給既有的 key

`RoadmapView.vue` 的卡片以檔名為 key，`items` 換成新陣列時 Vue 會依 key 搬動與更新既有的卡片，不會整批重建。不需要另外做差異比對。變動的卡片不加任何視覺提示。

### 刻意留給 Coder 的留白

以下兩項使用者看不出差別，不在這裡定案，也不是遺漏：

- **監看接幾個。** 可以改成一律監看 `openspec/` 再過濾出三處，也可以對 `changes/` 與 `roadmap/` 各接一個。條件是 D1 的範圍、`roadmap/` 一開始不存在的情況、以及「訂閱後隨即取消不留下監看」都要成立，而且 `isWatching()` 的意思不變（有沒有接上）
- **規劃檔變動時要不要省掉 Changes 清單那一次重載。** 通知不分來源，所以預設是照常重載。要省就得在監看那一層分辨來源，與 D2 牴觸，除非有明顯的效能問題否則不必做

## Risks / Trade-offs

- [改成監看 `openspec/` 整層時，範圍外的事件變多（歸檔、spec 同步都會產生一批）] → 範圍外的事件在進入合併等待之前就濾掉，不會發出通知
- [兩種形態對「目錄本身被建立或刪除」的事件算法不同：瀏覽器形態把 `changes` 這個路徑本身算在範圍內，桌面形態不算] → 這是既有差異，gateway 規格已用情境寫明。`roadmap/` 照各形態現有的算法處理，不在這次統一。使用者看得到的結果一致：目錄剛建好、裡面還沒有檔案時，Roadmap 頁顯示的本來就是同一個「尚無 roadmap」
- [規劃檔每存一次檔，Changes 清單就多跑一次 CLI] → 400 毫秒內的連續存檔已合成一次。Changes 清單的背景重新載入本來就不顯示任何狀態，使用者看不到
- [AI 工具連續改檔時，卡片會依排序規則移動位置，面板內文也可能在閱讀途中換掉] → 這是自動更新本來的意思，與 Changes 頁一致。面板保留捲動位置
- [只新增或刪除 spec 時，Roadmap 內文的 spec 連結不會即時更新] → 使用者已決定接受。spec 通常隨歸檔產生，歸檔會動到 `changes/`，那時就會重讀
