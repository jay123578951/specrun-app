## 1. 搬入第三方幾何運算

- [x] 1.1 從 thinking-orbs 取出幾何運算檔搬進專案，幾何部分一字不改，檔頭補上出處與 MIT 著作權聲明（Copyright (c) 2026 Jakub Antalik）；驗證：`pnpm typecheck` 通過，且檔頭聲明存在
- [x] 1.2 確認搬入檔與框架、DOM 無關；驗證：排除檔頭授權區塊後，對該檔搜尋 `react`、`document`、`window` 三個字均無結果（MIT 授權原文含 "documentation files"，是 1.1 要求逐字保留的法定文字，不計入）
- [x] 1.3 確認 `package.json` 未新增任何相依；驗證：`git diff package.json pnpm-lock.yaml` 無變更

## 2. 記號元件

- [x] 2.1 建立品牌記號元件的骨架：一個 canvas，畫布尺寸 `64 × dpr`、CSS 寬高 50px，繪圖座標對齊 64 的設計；驗證：側欄出現一塊 50×50px 的畫布，量測 CSS 尺寸與 device 畫布尺寸符合 design D2
- [x] 2.2 實作 accent 染色：把套件的明暗值映射到 `--sr-surface` 與 `--sr-accent-bright` 之間，不墊下限，抽成不碰 DOM 的純函式；驗證：單元測試涵蓋最暗端落在 surface、最亮端落在 accent-bright，中間值單調遞增
- [x] 2.3 接上每幀重畫迴圈，向 `resolvePreset('breathing', 64)` 取參數、speed 乘 0.60；驗證：開著 App 目視環緩慢起伏、不旋轉、外緣大小不變（spec「記號不旋轉」）
- [x] 2.4 把 lucide `terminal` 置中疊在環上，看得到 10.6px、畫出來筆畫 1.60px；驗證：目視提示符號完整，`>` 與 `_` 分辨得出來且未糊成一塊
- [x] 2.5 記號標為對輔助技術隱藏、不可聚焦、不可點、無 hover 與 press 樣式；驗證：Tab 巡覽側欄時焦點不停在記號上，點擊記號無任何視覺回饋與狀態變化（spec「記號不可互動」）

## 3. 迴圈的三條紀律

- [x] 3.1 元件掛上後無條件先畫一幀，之後才判斷要不要進入迴圈；驗證：在視窗從未取得焦點的情況下開啟 App，記號顯示完整定格而非空白（spec「開啟時視窗就沒有焦點」）
- [x] 3.2 以 `document.visibilityState` 控制啟停，MUST NOT 使用 `document.hasFocus()`；驗證：把焦點移到其他應用程式、specrun 視窗仍可見時記號繼續動；分頁切到背景後停止、切回後恢復（spec「看不見才停，沒有焦點不停」）
- [x] 3.3 `prefers-reduced-motion: reduce` 時只畫定格、不進迴圈，且此設定在執行中改變時立即反映；驗證：系統開啟減少動態後記號立刻停在定格，關閉後立刻開始動（spec「尊重減少動態的系統設定」）
- [x] 3.4 元件卸載時取消重畫迴圈並移除所有事件監聽；驗證：反覆切換專案與頁面後，瀏覽器效能面板中重畫迴圈數量不累積

## 4. 接進側欄

- [x] 4.1 `src/components/AppSidebar.vue` 的旋轉方塊換成記號元件，wordmark 與 `gap-2.5` 不動；驗證：側欄最上方由左至右為記號與 "specrun"，其餘兩段外觀不變
- [x] 4.2 確認版面影響與 spec 一致；驗證：量測品牌列高度為 85px、PROJECTS 段起點較改動前下移 16.4px、該列不換行且記號與 wordmark 均未被裁切（spec「記號的尺寸與它對側欄版面的影響」）
- [x] 4.3 確認記號不受 App 狀態影響；驗證：旁邊跑 `/srun:feat` 讓 watcher 觸發卡片高亮與進度變化、按手動刷新、製造 CLI 不可用的錯誤 banner，三種情況下記號動態皆無變化（spec「記號的動態與 App 狀態無關」）

## 5. 收尾

- [x] 5.1 在 `openspec/config.yaml` 的詞彙墓碑補一行：品牌記號 ← Logo（側欄最上方那一段的稱呼，本 change 改名）；驗證：該行存在且格式與既有三行一致
- [x] 5.2 全專案檢查通過；驗證：`pnpm lint`、`pnpm typecheck`、`pnpm test` 三者皆綠
- [x] 5.3 依 `specs/brand-mark/spec.md` 逐條人工驗收，並確認 `specs/change-list/spec.md` 的側欄四個既有 scenario 未被此改動破壞；驗證：每個 scenario 都實際操作過一次並符合描述
