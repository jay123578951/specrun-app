## 1. 設定檔擴充

- [x] 1.1 `server/utils/app-config.ts`：`AppConfig` 新增 `openspecBin: string | null`，`emptyConfig()` 預設 `null`
- [x] 1.2 `parseConfig()` 沿逐欄位收斂紀律處理該欄：非非空字串一律回 `null`（降級為自動偵測）
- [x] 1.3 `app-config.test.ts` 補案例：欄位缺失（舊設定檔）／型別不符／空字串／有效路徑，皆不影響其餘欄位解析

## 2. CLI 執行檔解析（design D3、D4）

- [x] 2.1 新增 CLI 解析模組：三段降級——① `execFile('openspec', ['--version'])` 吃行程 PATH ② `$SHELL -ilc 'command -v openspec'`（timeout 3s）取絕對路徑 ③ 皆未命中則回報不可用
- [x] 2.2 解析優先序：持久化的明示覆寫 ＞ 自動偵測結果；覆寫存在時不進行偵測
- [x] 2.3 非 darwin 平台跳過第 2 段，比照 `folder-picker.ts` 的 `canPickFolder()` 模式在伺服端判定能力
- [x] 2.4 login shell 輸出處理：只取 `command -v` 的最後一行非空白內容，忽略 rc 檔雜訊；解析出的路徑仍須通過 `--version` 才採用
- [x] 2.5 解析結果存為伺服端執行期狀態，提供更換入口（比照 `project-state.ts` 的持有方式）
- [x] 2.6 `openspec-cli.ts`：`runCli()` 的執行檔由常數 `CLI_BIN` 改為取自 2.5 的執行期狀態；移除該檔「留待後續 change」的過時註解
- [x] 2.7 `toProbeFailure()` 的 `cli-unavailable` 語意調整為「解析全數失敗後才成立」，錯誤分類本身不變
- [x] 2.8 單元測試：解析降級順序（第一段命中不進第二段）、覆寫優先、逾時視同未命中、非 darwin 跳過第 2 段、輸出解析忽略雜訊

## 3. 伺服端通道

- [x] 3.1 CLI 設定通道：取得目前模式與解析結果（模式、路徑、版本或失敗訊息）
- [x] 3.2 驗證並套用通道：以 `--version` 驗證指定路徑，成功才寫 config 並更換執行期狀態；失敗不寫入、目前生效者不變（design D6）
- [x] 3.3 重新偵測通道：清除快取的解析結果並重跑三段降級
- [x] 3.4 環境診斷通道：設定檔絕對路徑、目前專案路徑（無目標時明確表達為無）、watcher 是否運作、App 版本、開啟所在位置的能力旗標
- [x] 3.5 開啟檔案所在位置通道：能力判定在伺服端，不支援時以 status 表達（比照 `pick-folder.post.ts` 一律 200、前端依 status 分流）
- [x] 3.6 `src/api/types.ts` 補上以上通道的型別；`web-gateway.ts` 補實作，維持 `gateway` 為唯一入口（M4 換 Tauri 時呼叫端零改動）

## 4. Settings store 與套用流程

- [x] 4.1 新增 Settings store：開啟／關閉狀態、CLI 模式與路徑草稿、狀態列三態（尚未驗證／成功含版本／失敗含訊息）、診斷資料
- [x] 4.2 套用成功後的重載：`changes.invalidate()` ＋ `load()`、目前頁若為 specs 一併重載、背景 `refreshBadges()`；archived 與 watcher 不動（design D6）
- [x] 4.3 套用期間沿用既有世代／序號防護，晚到的舊回應不得寫回狀態
- [x] 4.4 套用成功後 modal 維持開啟，狀態列留成功態
- [x] 4.5 store 單元測試：驗證失敗不寫入且不重載、成功後重載範圍正確、archived 未被觸發

## 5. Settings modal 元件

- [x] 5.1 modal 外殼：置中、寬度依內容（約 620px，design 標示為留白可微調）、`--sr-shadow-overlay` ＋ 1px 邊框
- [x] 5.2 遮罩：`rgb(0 0 0 / 0.35)` 極輕壓暗、攔截點擊、點擊關閉（design D8／D9）
- [x] 5.3 進出場動畫：依 `ui-motion` skill 的固定值表取值
- [x] 5.4 CLI 區：自動偵測／手動指定兩模式互斥切換、目前模式標示、自動模式顯示解析到的絕對路徑與「重新偵測」
- [x] 5.5 手動模式：可編輯 mono 輸入欄 ＋ 取得路徑的提示文案（不做檔案選擇對話框，design D5）
- [x] 5.6 「驗證並套用」單一動作 ＋ 狀態列三態就地呈現（不走 toast）
- [x] 5.7 診斷區四行唯讀：設定檔位置、目前專案路徑（無目標時明確標示）、即時刷新狀態、App 版本
- [x] 5.8 診斷區的「開啟所在位置」動作；不支援平台呈現為禁用 ＋ tooltip 說明原因，不隱藏
- [x] 5.9 依 `ui-interaction-states` 檢查所有互動元素的狀態齊備（radio／輸入欄／按鈕的 hover／focus／disabled／busy）

## 6. modal 的鍵盤與焦點（design D10）

- [x] 6.1 `App.vue` 的 `onKeydown` 在 Settings 開啟時整個讓位（提早 return），Esc 不得穿透關閉背後的詳情面板
- [x] 6.2 Settings 自行處理 Esc 關閉
- [x] 6.3 focus trap：Tab 與 Shift+Tab 皆不得離開 modal；開啟時設定初始焦點
- [x] 6.4 關閉後 focus 歸還至開啟它的觸發元素

## 7. 入口接線

- [x] 7.1 `AppSidebar.vue`：Settings 由靜態 `div` 改為可互動按鈕，點擊開啟 Settings；MUST NOT 加當前頁高亮
- [x] 7.2 `view.ts`：改寫「Settings 仍是死項」的註解，說明 Settings 是覆蓋層、永不進入 `AppView` 聯集（design D2）
- [x] 7.3 `ChangeList.vue:114` 的 cli-unavailable banner：改寫「reachable on PATH, then refresh」文案並加「Open settings」入口（design D7）
- [x] 7.4 `SpecsView.vue:46` 的 cli-unavailable banner 同上
- [x] 7.5 確認開啟 Settings 不改變 nav 段高亮、不關閉已開啟的詳情面板

## 8. 樣式與 token

- [x] 8.1 `tokens.css`：新增遮罩色值；在 elevation 規範註解中補明 modal 為浮層例外的第三個適用者，並寫明 MUST NOT 擴及 slideover（`PanelShell` 的無遮罩規定不受影響）

## 9. 文件

- [x] 9.1 `ROADMAP.md`：Settings 自 M3 移出、改列為 M4 前置並補理由；里程碑表狀態欄更新
- [x] 9.2 `docs/ui-structure-decisions.md`：側欄第 4 項「⚙ Settings：底部固定不捲動」補上它是覆蓋層入口而非頁

## 10. 驗收

- [x] 10.1 `pnpm lint`、`pnpm typecheck`、`pnpm test` 全數通過
- [x] 10.2 對照 `specs/app-settings/spec.md` 逐條 scenario 手動驗收（特別是「Esc 不穿透」與「詳情開啟時開 Settings」）
- [x] 10.3 實測 CLI 解析降級：暫時把 openspec 移出 PATH，確認第 2 段命中；再以無效路徑覆寫，確認失敗提示與引導可用
