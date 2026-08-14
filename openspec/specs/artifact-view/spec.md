# artifact-view Specification

## Purpose

change 詳情檢視：點開卡片後的收合變形佈局（窄軌＋內容面板）、artifact tabs 與 Markdown 唯讀渲染，讓使用者在 App 內直接閱讀 proposal／design／specs／tasks 內容。

## Requirements

### Requirement: 詳情開啟與收合變形
點擊 change 卡片後，主區 SHALL 在同一畫面內變形為詳情檢視：清單縮為窄軌、內容面板取得其餘寬度；MUST NOT 以換頁或彈窗呈現。按 Esc（或關閉控制）SHALL 回到全寬清單，且清單捲動位置 SHALL 保留。

#### Scenario: 點卡片進入詳情
- **WHEN** 使用者點擊某張 change 卡片
- **THEN** 清單縮為窄軌、內容面板顯示該 change 的 artifact 內容，側欄不變

#### Scenario: Esc 返回保留捲動
- **WHEN** 使用者於詳情檢視按 Esc
- **THEN** 畫面回到全寬清單，捲動位置與進入前一致

### Requirement: 窄軌互動
窄軌 SHALL 僅顯示各 change 的名稱與進度，當前 change SHALL 高亮；點擊其他項或 ↑↓ 鍵 SHALL 切換至該 change，內容面板原地更新，MUST NOT 退出詳情檢視。

#### Scenario: 點擊窄軌切換
- **WHEN** 詳情檢視中使用者點擊窄軌上另一個 change
- **THEN** 內容面板更新為該 change 的內容，該項高亮

#### Scenario: 鍵盤切換
- **WHEN** 詳情檢視中使用者按 ↓ 鍵
- **THEN** 切換至窄軌的下一個 change，行為與點擊一致

### Requirement: artifact tabs 動態列出
內容面板 SHALL 依 gateway 回傳的 artifact 清單動態列出 tabs，MUST NOT 寫死 artifact 名稱（custom schema 必須可用）；首次進入詳情 SHALL 預設選 proposal tab；切換 change SHALL 保持當前 tab，目標 change 無同名 artifact 時 SHALL fallback 至 proposal（無 proposal 時取清單第一個）。

#### Scenario: custom schema 的 tabs
- **WHEN** 某 change 的 schema 定義了非預設的 artifact 集合
- **THEN** tabs 完整反映該集合，不出現寫死的預設名稱

#### Scenario: 切換 change 保持 tab
- **WHEN** 使用者在 design tab 下切換至另一個也有 design 的 change
- **THEN** 內容面板顯示新 change 的 design，tab 選取不變

#### Scenario: 目標無同名 artifact 的 fallback
- **WHEN** 使用者在 design tab 下切換至沒有 design 的 change
- **THEN** tab 選取 fallback 至 proposal 並顯示其內容

### Requirement: 缺件 artifact 的空狀態
尚未建立檔案的 artifact，其 tab SHALL 可點擊，點擊後內容區 SHALL 顯示空狀態提示；MUST NOT 以灰化禁用呈現。空狀態文案 SHALL 與錯誤提示可區分。

#### Scenario: 點擊缺件 tab
- **WHEN** 某 change 的 tasks 尚未建立，使用者點擊 tasks tab
- **THEN** 內容區顯示「此 artifact 尚未建立」語意的空狀態（英文文案），無錯誤樣式

### Requirement: Markdown 唯讀渲染
artifact 內容 SHALL 以 Markdown 渲染，支援 GFM 表格與 task list；code block SHALL 有語法高亮。詳情檢視 SHALL 為唯讀、MUST NOT 提供任何編輯能力，唯一例外為 tasks artifact tab 內的 task list checkbox 勾選（見「tasks checkbox 勾選」）；tasks 以外的 artifact，其 task list checkbox SHALL 呈現勾選狀態但 MUST NOT 可互動。tasks artifact 含多個檔案時（非預設 schema 的罕見情形）SHALL 同樣維持唯讀——勾選僅於單檔 tasks 開放。

#### Scenario: 非 tasks artifact 的唯讀 checkbox
- **WHEN** proposal 或 custom schema artifact 的內容含 task list 項目
- **THEN** 畫面呈現對應的勾選狀態，點擊 checkbox 無任何效果

#### Scenario: tasks 的唯讀 checkbox
- **WHEN** 某 change 的 tasks artifact 含多個既存檔案且其內容含 task list 項目
- **THEN** 畫面呈現對應的勾選狀態，點擊 checkbox 無任何效果

#### Scenario: code block 高亮
- **WHEN** artifact 內容含標註語言的 code fence
- **THEN** 該區塊以語法高亮呈現

### Requirement: tasks checkbox 勾選
tasks artifact tab 內的 task list checkbox SHALL 可互動：點擊 SHALL 觸發該 task 勾選狀態的翻轉並經 gateway 寫回檔案。UI SHALL 採樂觀更新——點擊當下 checkbox 立即呈現目標狀態，MUST NOT 等待寫入完成；單顆 checkbox 寫入進行中 SHALL 鎖定該顆、忽略對它的再次點擊，其他 checkbox 不受影響。寫入成功後 MUST NOT 額外重繪或提示——畫面已呈現目標狀態，後續刷新由既有變動通知機制吸收。

#### Scenario: 點擊立即翻轉
- **WHEN** 使用者點擊 tasks tab 內某未勾選的 checkbox
- **THEN** 該 checkbox 立即顯示為已勾選，不出現載入等待，寫入於背景完成

#### Scenario: in-flight 連點忽略
- **WHEN** 某 checkbox 的寫入尚未完成，使用者再次點擊同一顆
- **THEN** 該次點擊無任何效果，不產生第二次寫入請求

#### Scenario: 勾選反映至清單進度
- **WHEN** 勾選寫入成功，變動通知觸發清單與詳情重取
- **THEN** 卡片與窄軌的進度數字更新為引擎重算的結果，詳情畫面無可見閃爍

### Requirement: 勾選失敗的彈回與提示
勾選寫入失敗時，該 checkbox SHALL 彈回實際檔案狀態，並 SHALL 以非阻斷提示（toast）告知；衝突（目標行已被外部修改）與其他失敗的文案 SHALL 可區分，衝突提示 SHALL 傳達「內容已更新、請重新確認」語意。失敗 MUST NOT 以錯誤畫面打斷閱讀，既有內容維持顯示。

#### Scenario: 衝突彈回
- **WHEN** 點擊後寫入因目標行已被外部修改而遭放棄
- **THEN** 該 checkbox 彈回未寫入前的狀態，出現衝突語意的 toast，內容隨變動通知更新為最新版本

#### Scenario: 一般寫入失敗
- **WHEN** 寫入因 IO 或通道錯誤失敗
- **THEN** 該 checkbox 彈回原狀態，出現與衝突可區分的失敗 toast，詳情畫面不被錯誤畫面取代

### Requirement: specs 多檔串接
specs artifact 含多個檔案時，SHALL 串接為單頁連續捲動呈現，各檔內容前 SHALL 顯示其檔名（或 capability 路徑）標頭。

#### Scenario: 兩個 capability 的 specs
- **WHEN** 某 change 的 specs 下有兩個 spec 檔
- **THEN** specs tab 內兩檔依序串接，各自前方有可辨識的標頭

### Requirement: 連結行為
渲染內容中的外部 URL 連結 SHALL 於系統瀏覽器開啟（web 形態為新分頁）；相對路徑連結 SHALL 渲染為非互動樣式，點擊無反應（artifact 互跳與編輯器開啟為刻意延後範圍）。

#### Scenario: 外部連結
- **WHEN** 使用者點擊內容中的 https 連結
- **THEN** 連結於新分頁（或系統瀏覽器）開啟，App 畫面不變

#### Scenario: 相對路徑連結
- **WHEN** 內容含指向 ./design.md 的相對連結且使用者點擊
- **THEN** 無任何導航或開啟行為發生

### Requirement: 載入與新鮮度
每次進入詳情或切換 change，系統 SHALL 重新取得該 change 的詳情資料，MUST NOT 以快取取代重取。有快取的 change SHALL 立即顯示上次取得的內容、不等待請求完成；重取完成後內容有差異 SHALL 靜默更新並保留捲動位置，無差異 MUST NOT 重繪。詳情快取 SHALL 跨 session 持久化，持久層不可用時 SHALL 靜默降級為記憶體快取。清單載入完成後，系統 SHALL 依序背景預載各 active change 的詳情；使用者點開尚未預載的 change 時，該項 SHALL 優先取得。此預載屬掛載時載入一次的延伸；除此、進入／切換、手動刷新與變動通知觸發的自動重載（見「變動時自動重載當前詳情」）外，詳情 MUST NOT 自動重新載入。無快取可顯示時（罕見的墊底路徑），內容面板 SHALL 空著或僅顯示小型載入提示，MUST NOT 顯示 skeleton 動畫，MUST NOT 顯示前一個 change 的內容。

#### Scenario: 切換至有快取的 change
- **WHEN** 使用者自 change A 切換至已有快取的 change B
- **THEN** 內容面板立即顯示 B 上次的內容，背景重取完成後若有差異靜默更新

#### Scenario: 啟動預載後點開
- **WHEN** App 啟動、清單載入完成且預載已抓齊，使用者首次點開某 change
- **THEN** 內容面板立即顯示內容，無任何讀取動畫

#### Scenario: 重開 App 後點開
- **WHEN** 使用者重開 App 後點開上一個 session 看過的 change（背景重取尚未完成）
- **THEN** 內容面板立即顯示上次 session 的內容，重取完成後若有差異靜默更新

#### Scenario: 墊底路徑（無快取可顯示）
- **WHEN** 使用者點開一個全新 change，預載尚未排到且無任何快取
- **THEN** 內容面板空著或顯示小型載入提示（該項插隊優先取得），不顯示 skeleton 動畫，也不顯示前一 change 的內容

#### Scenario: 外部改動後重新點開
- **WHEN** 外部工具修改了某 artifact 檔案後，使用者重新點開該 change
- **THEN** 內容面板先顯示上次內容，重取完成後靜默更新為修改後的最新內容

### Requirement: 詳情手動刷新
使用者觸發詳情的手動 refresh 控制時，內容面板 SHALL 清空並顯示 skeleton（標題列＋文字行），完成後渲染最新內容——與導航動作（開卡片／切換）的無動畫載入形成刻意對比：主動刷新是「我要等新資料」的明示，SHALL 以 skeleton 回饋讀取中狀態，MUST NOT 以純文字提示替代。

#### Scenario: 手動刷新顯示 skeleton
- **WHEN** 使用者於詳情檢視按下 refresh 控制
- **THEN** 內容面板清空並顯示 skeleton，資料回傳後渲染最新內容

### Requirement: 詳情錯誤呈現
詳情資料取得失敗且畫面無可顯示的快取內容時，內容面板 SHALL 顯示可重試的錯誤提示（含 change 已不存在的情形），MUST NOT 永久停留在載入提示；文案（英文）SHALL 與缺件空狀態可區分。背景重取失敗但畫面已有快取內容時，SHALL 繼續顯示既有內容，MUST NOT 以錯誤畫面打斷閱讀（至多小型非阻斷提示）。CLI 不可用與非 openspec 專案的呈現 SHALL 沿用既有清單層的分層（常駐 banner／主區提示）。

#### Scenario: 詳情載入失敗（無快取）
- **WHEN** session 內首次點開某 change，取得詳情因 spawn 或讀檔失敗
- **THEN** 內容面板顯示可重試提示，重試後成功則正常渲染

#### Scenario: 背景重取失敗（有快取）
- **WHEN** 使用者切換至已看過的 change，畫面已顯示上次內容，背景重取失敗
- **THEN** 既有內容維持顯示，閱讀不被錯誤畫面打斷

#### Scenario: change 已被移除
- **WHEN** 使用者點開的 change 在開啟瞬間已被 archive 或刪除
- **THEN** 內容面板顯示可重試的錯誤提示，App 不崩潰

### Requirement: 變動時自動重載當前詳情
詳情開啟期間收到 gateway 變動通知，系統 SHALL 重新取得當前 change 的詳情。重取結果 SHALL 沿用既有靜默更新語意：內容有差異才換上並保留捲動位置，無差異 MUST NOT 重繪。自動重取失敗 SHALL 完全靜默——MUST NOT 顯示任何提示（含小型非阻斷提示），既有內容保留，由下一次通知或手動 refresh 自然重試。通知 MUST NOT 觸發對未開啟 change 的詳情請求；未開啟 change 的快取過期交由下次點開時的既有重取處理。

#### Scenario: 檢視中內容被外部修改
- **WHEN** 使用者正在閱讀某 artifact，外部工具修改了該檔案
- **THEN** 內容於短暫延遲後靜默更新為最新版本，捲動位置保留

#### Scenario: 無差異不重繪
- **WHEN** 通知觸發詳情重取，但該 change 內容未變（變動發生在其他 change）
- **THEN** 內容面板無任何可見變化，無重繪造成的閃爍

#### Scenario: 自動重取失敗靜默
- **WHEN** 通知觸發的詳情重取因寫檔瞬間的暫態失敗
- **THEN** 無任何提示出現，既有內容維持顯示

#### Scenario: 不對未開啟 change 發出請求
- **WHEN** 詳情開啟於 change A 時收到變動通知
- **THEN** 系統僅重取清單與 A 的詳情，不對其他 change 發出詳情請求

### Requirement: 檢視中 change 消失自動關閉
詳情開啟期間，若清單重載結果顯示當前 change 已不存在（被 archive 或刪除），詳情 SHALL 自動關閉並回到全寬清單，清單捲動位置 SHALL 依既有返回語意還原；MUST NOT 顯示錯誤提示或內容過期警告——這是正常消失，不是錯誤。

#### Scenario: 檢視中被 archive
- **WHEN** 使用者正在檢視某 change，外部執行 `openspec archive` 將其移除
- **THEN** 短暫延遲後詳情自動關閉、畫面回到全寬清單（該卡片已不在），全程無錯誤提示
