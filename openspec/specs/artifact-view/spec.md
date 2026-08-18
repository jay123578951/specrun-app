# artifact-view Specification

## Purpose

change 詳情檢視：點開卡片後自右側滑入、覆蓋於清單之上的面板、artifact tabs 與 Markdown 唯讀渲染，讓使用者在 App 內直接閱讀 proposal／design／specs／tasks 內容。

## Requirements

### Requirement: 詳情滑出面板
點擊 change 卡片後，內容面板 SHALL 自主區右側滑入、覆蓋於卡片清單上方；清單 MUST NOT 變形、移位或重排，MUST NOT 以換頁或彈窗呈現。面板 MUST NOT 滿版：左側 SHALL 保留固定寬度的露出區，清單於露出區內維持可見與可互動。面板 SHALL 以抬升一階的底色與左緣分隔線呈現層次，MUST NOT 使用陰影，MUST NOT 使用 backdrop 或任何攔截清單互動的遮罩。面板 header SHALL 提供收合控制（收合語意的圖示，MUST NOT 使用關閉「✕」意象）與手動 refresh 控制。按 Esc、點擊收合控制、或再次點擊當前開啟的卡片，面板 SHALL 滑出收合；收合後清單捲動位置 SHALL 與開啟前一致。

進出場 SHALL 為**自右緣滑入／滑出的純位移過場**（drawer 式）：面板全程不透明，MUST NOT 附加淡入淡出、模糊、縮放或彈跳。位移 SHALL 自面板完全隱藏的右緣位置起訖，MUST NOT 中途憑空出現或消失。時長與曲線 SHALL 讓全幅位移讀得出「滑行」的過程，MUST NOT 為高速掃過。退場時長 SHALL 短於進場時長。`prefers-reduced-motion: reduce` 下 SHALL 以淡入淡出取代位移，MUST NOT 退化為無過場的瞬間出現或消失。

#### Scenario: 點卡片滑出面板
- **WHEN** 使用者點擊某張 change 卡片
- **THEN** 內容面板自右側滑入覆蓋清單，卡片維持原位，左側露出區仍可見清單

#### Scenario: 進出場為右緣滑入滑出
- **WHEN** 面板開啟或收合
- **THEN** 面板自右緣以全程不透明的位移滑入定位／滑出至完全隱藏，過程無淡入淡出、無模糊或縮放，速度讀得出滑行而非瞬間掃過

#### Scenario: 退場比進場短
- **WHEN** 使用者收合面板
- **THEN** 收合過場明顯短於開啟過場

#### Scenario: reduced motion 保留淡入淡出
- **WHEN** 系統偏好設定為減少動態效果，使用者開啟或收合面板
- **THEN** 面板仍以淡入淡出過場、不帶位移，MUST NOT 瞬間出現或瞬間消失

#### Scenario: 收合控制
- **WHEN** 使用者點擊面板 header 的收合控制
- **THEN** 面板滑出收合，畫面回到完整清單，捲動位置與開啟前一致

#### Scenario: Esc 收合
- **WHEN** 使用者於面板開啟時按 Esc
- **THEN** 面板收合，行為與收合控制一致

#### Scenario: 無遮罩
- **WHEN** 面板開啟中
- **THEN** 左側露出區的清單無任何變暗或遮罩，卡片可直接點擊

### Requirement: 覆蓋檢視下的清單切換
面板開啟期間，當前開啟的 change 卡片 SHALL 以可辨識的選中狀態高亮；點擊露出區內其他卡片或按 ↑↓ 鍵 SHALL 切換至該 change，面板原地更新內容，MUST NOT 收合再重開。↑↓ 鍵切換 SHALL 依清單順序移動，切換到的卡片若在捲動範圍外 SHALL 被帶進視野。

面板原地更新內容時，**捲動內容區 SHALL 以短淡入呈現新內容**；面板外殼（位置、底色、邊界）MUST NOT 重新進場，header 的 change 名稱與露出區的卡片高亮 SHALL 立即更新，MUST NOT 淡入或延遲——身分回饋要能在連續切換時即時讀出。連續快速切換（如按住 ↑↓）SHALL 直接呈現最新內容，MUST NOT 排隊播放中間狀態、MUST NOT 因過場而延後新內容出現。內容淡入為純透明度變化，`prefers-reduced-motion: reduce` 下 SHALL 保留。

換 tab 與換 change 皆 SHALL 走同一套內容淡入機制，但 SHALL 各有自己的時長：換 change 是身分變更、換 tab 是同一份 change 換頁，兩者 MUST NOT 共用單一時值。任一者的淡入 SHALL 短到讀得出是換頁而非等待，且 MUST NOT 短到不可感知。內容區在任何切換下 MUST NOT 有左右方向的位移，MUST NOT 對容器高度做動畫。

#### Scenario: 點擊露出卡片切換
- **WHEN** 面板開啟於 change A，使用者點擊露出區內 change B 的卡片
- **THEN** 面板內容原地更新為 B，B 卡片高亮，面板不收合

#### Scenario: 原地換內容淡入
- **WHEN** 面板開啟於 change A，使用者切換至 change B
- **THEN** 面板捲動內容區以短淡入呈現 B 的內容，面板外殼不動、不重新進場

#### Scenario: 換 tab 的內容淡入
- **WHEN** 使用者在同一份 change 內切換 tab
- **THEN** 內容區以短淡入呈現新 tab 的內容，過場可被感知，內容不左右位移、容器高度不做動畫

#### Scenario: 身分回饋即時
- **WHEN** 使用者切換至另一個 change
- **THEN** header 的 change 名稱與該卡片的高亮立即更新，不隨內容淡入延後

#### Scenario: 連續快速切換不排隊
- **WHEN** 使用者按住 ↓ 鍵連續切換多個 change
- **THEN** 面板直接顯示最新一個 change 的內容，不排隊播放中間各次的過場，也不出現內容延遲

#### Scenario: 鍵盤切換
- **WHEN** 面板開啟時使用者按 ↓ 鍵
- **THEN** 切換至清單順序的下一個 change，行為與點擊一致

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

### Requirement: artifact tab 切換的過場
tabs 的選中指示 SHALL 為單一條可移動的底線，在同一份 change 內切換 tab 時 SHALL 自舊 tab 的位置與寬度**位移**至新 tab 的位置與寬度，MUST NOT 以原地淡出／淡入或瞬間跳位呈現。指示的起訖 SHALL 對齊當前 tab 的**文字**並於左右各留一段等寬餘裕，每顆 tab 適用同一條規則、MUST NOT 為任何一顆開特例；MUST NOT 因字體載入完成、tabs 數量變動或面板尺寸變動而長期偏離。

tabs 這一列 SHALL 對齊面板標題的左緣，以首顆 tab 的**文字**左緣為準（指示因左右餘裕而略微探出屬預期）。此對齊 SHALL 由 tabs 列整體承擔，MUST NOT 靠調整首顆 tab 自身的內距或外距達成——各 tab 的水平內距是點擊面積，一旦兼差當對齊工具，tab 間距與點擊面積必然被連帶犧牲。

切換 change 導致 tabs 整批換掉時，指示 SHALL 直接就位於新的選中 tab，MUST NOT 自舊位置滑行——跨 change 的 tabs 之間沒有位置關係可表達。

連續快速切換 tab 時，指示 SHALL 自當前所在位置改朝最新目標移動，MUST NOT 排隊播放中間各次、MUST NOT 從頭重播。

時長與曲線 SHALL 落在畫面內移動的既有規範內且短促（不可感知為等待）；`prefers-reduced-motion: reduce` 下 SHALL 移除位移，退回原地的顏色／透明度變化，MUST NOT 退化為無任何選中指示。

#### Scenario: 同一份 change 內換 tab
- **WHEN** 使用者在某 change 的 proposal tab 下點擊 specs tab
- **THEN** 選中底線自 proposal 的位置與寬度移動到 specs 的位置與寬度，過程讀得出移動而非跳位

#### Scenario: 首個 tab 的對齊
- **WHEN** 選中指示停在第一個 tab
- **THEN** 該 tab 的文字左緣與面板標題的左緣對齊，指示如其餘 tab 一樣左右各超出文字一段等寬餘裕——首顆套用的是同一條規則，不是特例

#### Scenario: tab 間距與點擊面積一致
- **WHEN** 檢視 tabs 列
- **THEN** 相鄰 tab 之間的間距處處相同，每顆 tab 的水平內距相同，首顆不因對齊需求而縮減可點範圍

#### Scenario: 換 change 不滑行
- **WHEN** 面板開啟於 change A 的 design tab，使用者切換至 change B
- **THEN** 選中指示直接出現在 B 的對應 tab 上，不從 A 的 tab 位置滑過去

#### Scenario: 連續快速切換不排隊
- **WHEN** 使用者在短時間內連點多個 tab
- **THEN** 指示自當前位置直接改朝最後一個被點的 tab 移動，不排隊播放中間各段

#### Scenario: 字體載入後仍對齊
- **WHEN** 首次開啟詳情面板、介面字體於畫面繪出後才載入完成而使 tab 寬度改變
- **THEN** 選中指示重新對齊到當前 tab 的實際位置與寬度

#### Scenario: reduced motion 降級
- **WHEN** 系統設為 `prefers-reduced-motion: reduce`，使用者切換 tab
- **THEN** 選中指示不帶位移地更新到新 tab，仍清楚指出當前選取

### Requirement: 缺件 artifact 的空狀態
尚未建立檔案的 artifact，其 tab SHALL 可點擊，點擊後內容區 SHALL 顯示空狀態提示；MUST NOT 以灰化禁用呈現。空狀態文案 SHALL 與錯誤提示可區分。

#### Scenario: 點擊缺件 tab
- **WHEN** 某 change 的 tasks 尚未建立，使用者點擊 tasks tab
- **THEN** 內容區顯示「此 artifact 尚未建立」語意的空狀態（英文文案），無錯誤樣式

### Requirement: Markdown 唯讀渲染
artifact 內容 SHALL 以 Markdown 渲染，支援 GFM 表格與 task list；code block SHALL 有語法高亮。詳情檢視 SHALL 為唯讀、MUST NOT 提供任何編輯能力，唯一例外為 tasks artifact tab 內的 task list checkbox 勾選（見「tasks checkbox 勾選」）；tasks 以外的 artifact，其 task list checkbox SHALL 呈現勾選狀態但 MUST NOT 可互動。tasks artifact 含多個檔案時（非預設 schema 的罕見情形）SHALL 同樣維持唯讀——勾選僅於單檔 tasks 開放。已勾選的 task list 項目 SHALL 以刪除線與降階字色與未完成項目區辨，此呈現 SHALL 一致套用於所有 artifact，不隨 checkbox 是否可互動而異。

#### Scenario: 非 tasks artifact 的唯讀 checkbox
- **WHEN** proposal 或 custom schema artifact 的內容含 task list 項目
- **THEN** 畫面呈現對應的勾選狀態，點擊 checkbox 無任何效果

#### Scenario: tasks 的唯讀 checkbox
- **WHEN** 某 change 的 tasks artifact 含多個既存檔案且其內容含 task list 項目
- **THEN** 畫面呈現對應的勾選狀態，點擊 checkbox 無任何效果

#### Scenario: 已完成項目的視覺區辨
- **WHEN** 任一 artifact 的內容含已勾選的 task list 項目
- **THEN** 該項目的文字以刪除線與降階字色呈現，與未完成項目一眼可分；此區辨不因 artifact 是否可互動而不同

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
