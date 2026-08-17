## 1. 面板進出場（三頁共用）

- [x] 1.1 `src/App.vue:36` 的 `PANEL_MOTION`：`enter-from-class`／`leave-to-class` 由 `translate-x-full` 換成 `translate-x-[40px] opacity-0`（位移釘死 px 的理由見 design D2）
- [x] 1.2 同處 `enter-active-class`／`leave-active-class`：過場屬性改為 `transition-[transform,opacity]`（Wind4 會展開含 `translate`），時長改 `duration-250`／`duration-180`，曲線與 `sr-motion` 維持不變
- [x] 1.3 更新 `PANEL_MOTION` 上方註解：說明「短位移＋同拍淡入」的來源（transitions.dev panel-reveal）與刻意不採 blur（design D1），並註明 40px 為何釘死 px
- [x] 1.4 【v2 解耦，取代 1.2 的同拍配方】`src/styles/interactions.css`：新增 `.panel-reveal-enter`／`.panel-reveal-leave`——進場 `translate 250ms var(--sr-ease-in-out), opacity 100ms var(--sr-ease-out)`；退場 `translate 180ms var(--sr-ease-in-out), opacity 80ms var(--sr-ease-out) 100ms`（translate 排第一，`.sr-motion` 降級時 opacity 才承接整段時長；design D3）
- [x] 1.5 `PANEL_MOTION` 的 `enter-active-class`／`leave-active-class` 改指向手寫 class（`sr-motion` 保留），註解改記解耦理由與 translate 用 in-out 的依據（畫面內就位的移動、ease-in 段落在不可見窗口）
- [x] 1.6 【v3 純位移，取代 1.4／1.5 的解耦配方】`src/styles/tokens.css` 新增 `--sr-ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`；`.panel-reveal-enter`／`.panel-reveal-leave` 改為 `translate 300ms`／`220ms var(--sr-ease-drawer)`，各附 1ms 幽靈 opacity（進場貼起點、退場 delay 219ms；translate 排第一，reduced motion 降級承接用；design D3 v3／D5）
- [x] 1.7 `PANEL_MOTION` 的 from／to class 改回 `translate-x-full`（保留 `opacity-0` 作幽靈值），註解改記 v3：全幅純位移、fade 兩輪驗收後移除、幽靈 opacity 的作用

## 2. 原地換內容淡入（共用外殼）

- [x] 2.1 `src/components/PanelShell.vue`：捲動容器（`ref="scroller"`）加互斥的 class 分支——淡入起點 `opacity-0 transition-none`，其餘時候 `transition-opacity duration-120 ease-[var(--sr-ease-out)]`（兩分支不可同時存在，理由見 design D7）
- [x] 2.2 在既有的 `scrollKey` watcher 內接上淡入：壓到 `opacity-0` → `await nextTick()` → 雙 `requestAnimationFrame` 後放回；捲動歸零維持原行為
- [x] 2.3 加上快速連按閘門：距上次切換 <200ms 只換內容、不播淡入（具名常數＋註解說明它擋的是鍵盤連按，design D7）
- [x] 2.4 元件卸載時清掉可能在飛的 rAF／計時器，避免面板收合瞬間切換觸發殘留回呼

## 3. 註解校正

- [x] 3.1 `src/styles/interactions.css:51` 的 `.sr-motion` 註解：主體改為「面板與 toast」，並記下 `transform: none` 對 Wind4 的 `translate-*` utility 是空砲、真正生效的是 `transition-property: opacity`（design D6）。宣告本身不動

## 4. 驗收

- [x] 4.1 `pnpm run lint`、`pnpm run typecheck` 通過
- [x] 4.2 三頁各開一次面板確認進出場一致：Changes 點卡片、Specs 點列、Archived 點卡片；收合明顯比開啟快
- [x] 4.3 開啟中點另一張卡片：內容區淡入、面板外殼不重新進場、標題與卡片高亮即時更新
- [x] 4.4 按住 ↓ 連續切換：內容不閃爍、不延遲，最後停在最新一筆；放開後單次按鍵仍有淡入
- [x] 4.5 換 tab 也吃到同一個淡入（`scrollKey` 含 `currentTab`，刻意接受）
- [x] 4.6 系統開啟「減少動態效果」後重測開啟／收合：仍有淡入淡出、無位移，MUST NOT 瞬間出現或消失
- [x] 4.7 DevTools animation inspector 以 2–5× 慢放檢查：進出場全程不透明、無任何淡入淡出殘留（幽靈 opacity 不可感知），速度讀起來是「滑行」而非掃過（design D3 v3／風險段）
- [x] 4.8 面板自右緣完全隱藏處起步與收尾，開始與結束瞬間無憑空出現、無殘影（design D2 v3）
