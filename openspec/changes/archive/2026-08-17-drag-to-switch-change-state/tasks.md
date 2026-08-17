## 1. 前置：既有決策文件更新

- [x] 1.1 `docs/ui-structure-decisions.md`：移除「已否決項」表中的「拖曳 park/unpark」列，改記為已重新評估並附本 change 名稱與推翻理由（群組僅兩個、不做重排，邊界情況遠小於原估）
- [x] 1.2 `docs/ui-structure-decisions.md`：更新「主區：雙群組同頁」段落，把「無 parked change 時整段隱藏」改為「只要存在任何卡片即兩群組皆呈現」，並記明兩群組皆空時 Parked 整段不顯示的例外與其理由（無卡片可拖，落點無作用）
- [x] 1.3 `ROADMAP.md`：更新 M2 已收斂決策中「無 parked change 時整段隱藏（P1 定案）」的記述（含雙空例外）；並把「拖到清單邊緣自動捲動」與「觸控裝置拖曳優化」加入「後續觀察項（不排程）」

## 2. 群組呈現條件與空落點（spec change-list：群組、排序與恆常呈現、空狀態）

- [x] 2.1 `src/components/ChangeList.vue`：`showParked` 的條件由 `parkedCount > 0` 改為「`parkedCount > 0 || activeCount > 0`」——只要存在任何卡片就顯示 Parked 群組（含標題與數量 0）；兩群組皆空時整段不顯示（design D5）
- [x] 2.2 新增空落點區塊元件（Parked 群組專用），支援三態樣式：常駐低強度（`border-line/40` dashed、`text-text-3`、陳述句文案）／拖曳中高強度（`border-line` dashed、`accent/6` 底、`text-text-2`、放手動作語意文案）／不可用灰化
- [x] 2.3 不可用態文案沿用 `ChangeCard.vue` 既有的 `actionTitle` 兩則降級提示字串（非 git repo／git worktree），抽成共用常數避免兩處分岔
- [x] 2.4 `src/components/StateNotice.vue`：新增「拖曳目的地」態——由自身的 `border-line` 實線切為 dashed、提亮並加 `accent/6` 底，MUST NOT 由呼叫端在其外層另加 outline（design D4：它已有實線框，外加即成雙層框）；未進入該態時外觀完全不變
- [x] 2.5 `src/components/ChangeList.vue`：Active 空狀態 `body` 文案改為隨 `parkedCount` 條件切換（英文）——有 parked 時涵蓋「以 openspec CLI 建立」與「自 Parked 拖回」；無 parked 時只留前者，不提拖回（design D5 連帶後果）

## 3. store：樂觀搬移狀態（design D8）

- [x] 3.1 `src/stores/changes.ts`：新增樂觀搬移狀態（對象 change 名稱＋方向），與既有 `parkPending` 合併為單一真值，不並存兩組狀態
- [x] 3.2 新增套用樂觀層的 computed 顯示清單（active／parked 各一），`changes.value` 與 `parked.value` 保持只承載伺服端真實資料——`loadSilently()` 的整批替換不得影響樂觀呈現
- [x] 3.3 `runParkAction()` 改為：先設樂觀狀態 → 呼叫 gateway → 成功則 `load()` 後清除樂觀狀態；失敗則標記為待回滾（供 UI 播放返回動畫）後清除，toast 行為不變
- [x] 3.4 樂觀層套用時若找不到對象 change（已被外部刪除），SHALL 靜默中止該樂觀狀態，不顯示錯誤
- [x] 3.5 補 store 測試：樂觀期間 `loadSilently()` 替換底層資料後顯示清單仍正確、成功後樂觀狀態不殘留、失敗後回到原群組

## 4. 拖曳互動（spec change-list：拖曳卡片切換狀態、拖曳取消與禁用）

- [x] 4.1 `src/components/ChangeCard.vue`：`pointerdown` 記錄起點並 `setPointerCapture`；位移超過 5px 門檻才進入拖曳狀態，門檻內放開走既有 `open()` 點擊路徑
- [x] 4.2 同檔：Park／Restore 按鈕區域的 `pointerdown` 不啟動拖曳
- [x] 4.3 同檔：拖曳啟動時以 `getBoundingClientRect()` 量測卡片高度並上報（供原位凹槽使用，design D9）
- [x] 4.4 同檔：拖曳狀態下移除 `card-lift` class（design D7），套用 `transform: translate(...) scale(1.02)`、`--sr-shadow-overlay`、`cursor: grabbing`；border 顏色不變
- [x] 4.5 同檔：拖曳結束（`pointerup`／`pointercancel`）釋放 pointer capture；拖曳過的那次互動不觸發 `open()`
- [x] 4.6 `parkAvailable` 為 false 時 `pointerdown` 完全不進入拖曳流程（design：禁用邊界）
- [x] 4.7 `src/components/ChangeList.vue`：管理拖曳工作階段狀態（拖曳中的 change、來源群組、指標位置、卡片高度），並判定放手時的落點群組

## 5. 落點與原位標示（spec change-list：拖曳中的落點與原位標示）

- [x] 5.1 拖曳啟動即標示對面群組為目的地（不等指標移入），來源群組永不標示
- [x] 5.2 有卡片的群組用 `outline: 1px dashed` ＋ `outline-offset` ＋ 極淡 accent 底（MUST NOT 用 border 或 padding，避免版面位移，design D3）
- [x] 5.3 群組為空時改由該群組的空內容區塊自身切換至高強度態，且不疊加群組 outline（design D4）——Parked 為落點區塊、Active 為 `StateNotice`，兩者都要驗證只有單層框
- [x] 5.4 原位凹槽：`bg-bg` ＋ 1px dashed `border-line`，高度取 4.3 的實測值，位置在拖曳期間固定不動
- [x] 5.5 確認凹槽與 `TransitionGroup` 的既有進出場／重排動畫共存，拖曳期間不觸發卡片離場動畫

## 6. 落地、回滾與降級

- [x] 6.1 放手於合法目的地 → 觸發 store 的樂觀搬移；卡片立即呈現於目的地群組並帶進行中標示
- [x] 6.2 放手於來源群組內或清單外 → 卡片以動畫返回原位，不觸發任何操作、不顯示錯誤
- [x] 6.3 操作失敗 → 卡片以 250ms `--sr-ease-in-out` 返回原群組原位，toast 照既有規則顯示
- [x] 6.4 `src/styles/interactions.css`：reduced motion 區塊新增拖曳降級——移除 `scale`、返回原位改為即時；凹槽、目的地標示、底色與文案切換一律保留（拖曳本身 MUST NOT 停用）

## 7. 驗證

- [x] 7.1 `pnpm test` 全綠
- [x] 7.2 `pnpm typecheck` 與 `pnpm lint` 無新增問題
- [x] 7.3 `openspec validate --strict drag-to-switch-change-state` 通過
- [x] 7.4 手動驗收（dogfood）：active→parked 拖曳成功、parked→active 拖曳成功、微小位移仍開詳情、拖曳後不開詳情、按鈕上拖不啟動拖曳、同群組內放手取消、清單外放手取消
- [x] 7.5 手動驗收（標示）：拿起即見目的地標示、來源群組不亮、標示出現時卡片零位移、原位凹槽與卡片同高且不移動；空群組僅單層標示——Parked 空落點與 Active 的 `StateNotice` 兩種都要看
- [x] 7.6 手動驗收（樂觀與失敗）：放手立即落位且帶進行中標示、park 撞名時卡片飛回原位並出 toast、操作期間旁邊存檔觸發 watcher 重載不造成閃動
- [x] 7.7 手動驗收（降級）：非 git repo 專案無法拖曳且空落點呈不可用態、系統開啟減少動態後仍可拖曳但無縮放與補間
- [x] 7.8 手動驗收（群組呈現條件）：把全部 change 都 park 掉 → Active 空但兩群組都在、其文案提及拖回；再把 parked 全部 unpark 並刪除所有 change → 兩群組皆空時只剩 Active 引導、Parked 整段消失、文案不提拖回
- [x] 7.9 人工判斷常駐空落點區塊的視覺噪音是否可接受（design 已記退路：降為僅標題＋數量、落點改拖曳中才出現）
