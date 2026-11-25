# Proposal

## Why

使用者改了 `openspec/roadmap/` 裡的規劃檔之後，Roadmap 頁不會自己更新，一定要按刷新或重新進頁才看得到新內容。先前的 `tick-relative-time` 只讓「多久以前更新」的時間文字每分鐘重算，沒有重新讀檔，所以用起來像是自動更新沒有作用。

原因有兩層。檔案變動通知只涵蓋 `openspec/changes/`，規劃檔的變動沒有人通知。`roadmap-view` 規格還明文規定不得為 Roadmap 頁擴充檔案變動監看。這次把這條規定反過來。

## What Changes

- 檔案變動通知的範圍在 `openspec/changes/` 之外，加上 `openspec/roadmap/` 底下與 `openspec/roadmap.off` 這個檔案。瀏覽器形態與桌面形態都改
- 使用者停在 Roadmap 頁時收到通知，清單在背景重新載入。清單不清空、不出現載入佔位、刷新控制不轉圈
- 背景重新載入失敗時不顯示任何提示，保留舊內容
- 詳情面板開著時內容跟著更新並保留捲動位置。開著的規劃檔被刪除或改名時面板關閉，不提示
- 通知不區分來源。change 的檔案變動也會讓停在 Roadmap 頁的畫面重新載入，內文裡指向 change 的連結因此跟著更新
- 移除 `roadmap-view` 的「MUST NOT 為 Roadmap 頁擴充檔案變動監看」
- 保留 `roadmap-view` 的「背景變動不自動更新」情境名稱，內容改寫成停在 Changes 頁時不讀取

不在這次範圍：

- Specs 頁與 Archived 頁維持不監看
- `openspec/specs/` 不進通知範圍。只新增或刪除 spec 時，Roadmap 內文的 spec 連結要等下一次通知、手動刷新或重新進頁才更新
- 不監看 `.git`。git 提交本身不會觸發重新載入

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `openspec-gateway`：「檔案變動通知」的通知範圍由只有 `openspec/changes/` 擴為 `changes/`、`roadmap/` 與 `roadmap.off`
- `roadmap-view`：「切頁即關與重新載入」移除不得監看的規定；新增「變動時自動重載」「自動重載失敗時靜默」「變動時面板隨之更新」三條需求

`desktop-shell`、`app-settings`、`change-list` 提到檔案變動通知的文字已檢查過，都不需要改：它們描述的是通知由誰持有、診斷資訊怎麼呈現、Changes 清單收到通知後怎麼做，這三件事都沒變。

## Impact

- `server/utils/change-watcher.ts`：瀏覽器形態的監看範圍
- `src/api/desktop/watch.ts`：桌面形態的監看範圍
- `src/stores/roadmap.ts`：新增背景重新載入
- `src/App.vue`：收到通知時，使用者停在 Roadmap 頁就觸發背景重新載入
- `src/components/RoadmapPanel.vue` 或 `src/components/MarkdownView.vue`：引用名稱清單改變時，面板內文的連結要重新判斷
- 對應的測試檔：`src/api/desktop/watch.test.ts`、`src/stores/roadmap.test.ts`、`src/App.test.ts`、`src/components/RoadmapPanel.test.ts`，以及新增 `server/utils/change-watcher.test.ts`
- 無新相依套件、無 API 路徑變動
