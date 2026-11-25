# Tasks

## 1. 通知範圍加上 roadmap

- [x] 1.1 `src/api/desktop/watch.ts`：通知範圍擴為 `openspec/changes/` 底下、`openspec/roadmap/` 底下與 `openspec/roadmap.off`（design D1）；`roadmap/` 一開始不存在時，之後建立並寫入檔案也要通知。檔頭註解同步改寫。驗證：在 `src/api/desktop/watch.test.ts` 補案例並通過：規劃檔修改會通知、`roadmap.off` 建立與刪除會通知、`openspec/specs/` 與 `openspec/config.yaml` 的變動不通知、`roadmap/` 原本不存在而後出現第一個檔案會通知；既有案例（合併為一則、切專案跟隨、訂閱後隨即取消不留下監看）全數仍通過
- [x] 1.2 `server/utils/change-watcher.ts`：同 1.1 的範圍，檔頭註解同步改寫。驗證：新增 `server/utils/change-watcher.test.ts`，以暫存目錄實際寫檔，涵蓋與 1.1 相同的四個案例加上「連續寫入只得一則通知」，`pnpm vitest run server/utils/change-watcher.test.ts` 通過

## 2. Roadmap store 的背景重新載入

- [x] 2.1 `src/stores/roadmap.ts` 新增背景重新載入（design D3）：成功換上新資料並清掉 `listError`，開著的規劃檔不在新清單時關閉面板；失敗什麼都不做；全程不碰 `firstLoadPending` 與 `refreshing`；`reset()` 之後才回來的回應丟掉。把「丟掉過期回應」與「清進行中狀態」拆成兩顆序號，背景重新載入不得讓飛在半路的 `load()` 清不掉 `refreshing`。驗證：在 `src/stores/roadmap.test.ts` 補案例並通過：成功時資料更新且 `refreshing` 從頭到尾為 false、失敗時 `items` 與 `listError` 都不變、原本有 `listError` 時成功會清掉並填入清單、開著的檔案消失時 `openFileName` 變 null、`load()` 進行中插入一次背景重新載入後 `refreshing` 最終回到 false、`reset()` 後才回來的回應不會把資料填回去

## 3. 接上通知與面板更新

- [x] 3.1 `src/App.vue` 的 `syncFromWatcher`：目前頁是 Roadmap 時呼叫 2.1 的背景重新載入，既有兩步不動（design D4）。驗證：在 `src/App.test.ts` 補案例並通過：停在 Roadmap 頁收到通知會呼叫一次 `listRoadmap`、停在 Changes 頁收到通知不呼叫 `listRoadmap`
- [x] 3.2 面板內文的引用連結在名稱清單內容改變時重新判斷，內容相同時不重繪（design D5）。驗證：在 `src/components/RoadmapPanel.test.ts` 補案例並通過：背景重新載入後名稱清單多了一個 change，內文裡該名稱由純文字變成 change 連結；背景重新載入後內文與名稱清單都沒變，面板的 markdown 沒有重新渲染；只有另一個規劃檔的內文改變時，開著的面板沒有重新渲染
- [x] 3.3 清單原地更新的元件測試。驗證：在 `src/components/RoadmapView.test.ts` 補案例並通過：背景重新載入後某卡片的狀態字由 `0/4` 變 `1/4`，卡片移到 In progress 組，過程中沒有出現載入佔位、刷新控制沒有進入進行中狀態；背景重新載入失敗時清單維持原樣且沒有錯誤提示

## 4. 整體檢查

- [x] 4.1 `pnpm test`、`pnpm lint`、`pnpm typecheck` 全部通過（由 gate 覆蓋：全部測試 69 檔 1063 個全過，lint 與 typecheck 實跑 exit 0）
- [x] 4.2 在 App 裡手動確認（瀏覽器形態與桌面形態各一次）：停在 Roadmap 頁，用編輯器改一個規劃檔的狀態字並存檔，約半秒內卡片自己換組，不需按刷新；開著面板時在檔案末尾加一段，面板出現新段落且捲動位置不變；刪除開著的規劃檔，面板自己關閉且沒有提示

## Workflow follow-up

- 驗收通過後依序 `/opsx:sync`、`/opsx:archive`
- 程式碼、規格同步與歸檔放在同一個 commit
