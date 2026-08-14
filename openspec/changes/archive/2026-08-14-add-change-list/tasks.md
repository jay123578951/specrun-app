# add-change-list Tasks

## 1. Gateway 與後端通路

- [x] 1.1 定義 App 型別與 gateway 介面（`src/api/`）：Change 清單型別、三類錯誤型別、gateway 介面抽象
- [x] 1.2 實作 shared normalize 純函式：CLI stdout JSON＋exit code → App 型別；含 root.path canonical 比對與 exit 1 診斷 payload 解析（design D3）
- [x] 1.3 normalize 單元測試：正常清單／三個 status 值／root.path 不一致／診斷 payload／不可解析輸出
- [x] 1.4 實作 Nitro route `GET /api/changes`：讀專案路徑設定（env fallback repo 自身）、spawn `openspec list --json`、原樣轉送 stdout 與 exit code；CLI 找不到時回報 CLI 不可用
- [x] 1.5 實作 webGateway（fetch `/api/changes` → normalize），接上 gateway 介面

## 2. 清單畫面

- [x] 2.1 側欄靜態殼：四段結構依 `docs/ui-structure-decisions.md`，專案徽章接真實 change 數，死項不灰化（design D8）
- [x] 2.2 Change 卡片元件：標題／進度條＋n/m／相對時間；no-tasks 與 complete 兩態呈現（spec change-list）
- [x] 2.3 主區清單：Active 群組標題含數量、卡片依回傳序渲染、hover 僅視覺抬升
- [x] 2.4 Skeleton 載入態：2–3 張同尺寸骨架、無 layout shift（design D6）
- [x] 2.5 手動 refresh：保留舊資料、按鈕進行中狀態；掛載時載入一次、無其他自動重抓
- [x] 2.6 錯誤與空狀態：CLI 不可用 banner／非 openspec 專案提示／暫時性失敗 toast／無 change 空狀態，四者文案可區分（英文）

## 3. 驗證與收尾

- [x] 3.1 建多 change 測試 repo，以 env 指向驗證：多卡片、no-tasks、complete、非 openspec 路徑、CLI 路徑失效各情境
- [x] 3.2 對照兩份 delta spec 逐 scenario 走查；wireframe 與實際畫面比例核對
