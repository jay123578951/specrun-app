## 1. 覆蓋佈局

- [x] 1.1 App.vue 主區改為 relative 容器：ChangeList 常駐，移除 grid 欄寬換檔與 ChangeRail 渲染
- [x] 1.2 ArtifactPanel 改為容器內絕對定位覆蓋（right-0、寬 calc(100% - 320px)），露出寬以常數定義
- [x] 1.3 面板底色改 bg-surface、左緣 border-line；確認無陰影、無 backdrop
- [x] 1.4 進出場動畫：translate-x 滑入滑出，曲線與時長依 design 決策（只動 transform）

## 2. ChangeRail 移交

- [x] 2.1 ↑↓／Esc 鍵盤監聽（含輸入元素豁免與 scrollIntoView）搬至 App 層
- [x] 2.2 刪除 ChangeRail.vue 與所有引用

## 3. 面板 header 控制

- [x] 3.1 左上收合鈕：箭頭收合意象 icon（非 ✕），點擊收合面板
- [x] 3.2 右上 Refresh：沿用「清單＋當前詳情一起重取」語意與 busy 狀態

## 4. 卡片互動

- [x] 4.1 當前開啟卡片高亮（bg-accent/25＋aria-current），面板收合時清除
- [x] 4.2 點擊分流：點當前卡片收合、點其他卡片原地切換；Park／Restore 不觸發開合

## 5. 驗收

- [x] 5.1 對照 delta specs 逐 scenario 走查（滑入不動清單、露出區可點、Esc／收合鈕／再點收合、鍵盤切換、捲動保留）
- [x] 5.2 邊界情境：檢視中 change 被 archive 自動收合、輸入元素內按 Esc 不觸發收合
