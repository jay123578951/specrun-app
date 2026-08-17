# change-list Specification

## Purpose

App 的主畫面：以卡片清單呈現目標專案的進行中 change 與任務進度，涵蓋載入、刷新、錯誤與空狀態行為，以及側欄外殼。

## Requirements

### Requirement: change 卡片內容
主區 SHALL 以卡片列出每個進行中 change，每張卡片 SHALL 含：change 名稱、任務進度條與 n/m 數字、相對時間（active 卡片為最後修改；parked 卡片為 park 時點，如「parked 3w ago」）、以及該 change 的 Why 摘錄。UI 文案 SHALL 一律使用英文。

Why 摘錄 SHALL 取自該 change proposal 的 `## Why` 段落首句（取得規則見 `openspec-gateway`），並 SHALL 最多顯示兩行、超出部分以省略號截斷。摘錄 MUST NOT 經 LLM 或任何生成式加工。active 與 parked 卡片 SHALL 以相同方式呈現摘錄。

摘錄為空（無 proposal、無 `## Why` 段落或讀取失敗）時，卡片 MUST NOT 顯示摘錄區塊，也 MUST NOT 為其保留空白佔位——此時卡片高度較有摘錄的卡片為低，清單中卡片高度不一致 SHALL 為可接受行為。摘錄為空 MUST NOT 呈現為錯誤或缺件提示。

#### Scenario: 進行中 change 的卡片
- **WHEN** 某 change 有 2/4 個任務完成
- **THEN** 卡片顯示 change 名稱、約半滿的進度條、「2/4」與相對時間

#### Scenario: 無任務的 change
- **WHEN** 某 change 的 totalTasks 為 0（status `no-tasks`）
- **THEN** 卡片顯示空進度軌與「No tasks」文字，不顯示 n/m 數字

#### Scenario: 已完成的 change
- **WHEN** 某 change 全部任務完成（status `complete`）
- **THEN** 卡片以可辨識的完成狀態呈現（進度條滿且採完成語意色）

#### Scenario: parked 卡片的時間欄位
- **WHEN** 某 change 於三週前被 park
- **THEN** 該卡片時間欄位顯示 park 相對時間（如「parked 3w ago」），而非檔案最後修改時間

#### Scenario: 顯示 Why 摘錄
- **WHEN** 某 active change 的 proposal 含 `## Why` 段落，其首句可抽出
- **THEN** 該卡片在進度條之外另顯示該首句，最多兩行

#### Scenario: 長摘錄截斷
- **WHEN** 某 change 的 Why 首句長度超過卡片兩行可容納的字數
- **THEN** 摘錄顯示至第二行結尾並以省略號截斷，卡片高度不因該摘錄增長

#### Scenario: parked 卡片同樣顯示摘錄
- **WHEN** 某 parked change 的 proposal 含可抽出的 `## Why` 首句
- **THEN** 該卡片以與 active 卡片相同的方式顯示摘錄

#### Scenario: 無摘錄可顯示
- **WHEN** 某 change 沒有 proposal 檔案，或其 proposal 無 `## Why` 段落
- **THEN** 該卡片不顯示摘錄區塊、不顯示佔位空白、不顯示任何錯誤或缺件提示

### Requirement: 群組、排序與恆常呈現
清單 SHALL 分為「Active」與「Parked」兩群組同頁呈現，各群組標題含數量；Active 卡片順序 SHALL 為資料來源回傳的順序（lastModified 新→舊），前端不重排；Parked 卡片 SHALL 依 park 時間新→舊排序。

只要兩群組中存在任何一張卡片，兩群組 SHALL 皆呈現（含標題與數量），MUST NOT 因其中一個群組無卡片而隱藏——拖曳切換狀態需要恆常存在的落點（見「拖曳卡片切換狀態」）。

兩群組皆無卡片時為例外：該狀態下沒有任何可拖曳的卡片，落點無作用，此時 Parked 群組 SHALL 整段不顯示（標題與落點區塊皆不呈現），主區只呈現 Active 群組及其引導空狀態。群組為空時的內容呈現見「空狀態」。

#### Scenario: 群組標題數量
- **WHEN** 有 3 個進行中 change 與 2 個 parked change
- **THEN** 群組標題分別顯示「Active (3)」與「Parked (2)」

#### Scenario: 無 parked 時仍顯示群組
- **WHEN** 專案有 active change 但沒有任何 parked change
- **THEN** 主區仍顯示「Parked (0)」群組標題與其空狀態內容

#### Scenario: 無 active 時仍顯示群組
- **WHEN** 專案所有 change 均已 park，Active 群組無卡片
- **THEN** 主區仍顯示「Active (0)」群組標題與其空狀態內容

#### Scenario: 完全無 change 時只呈現引導
- **WHEN** 專案的 active 與 parked 群組皆無卡片
- **THEN** 主區只呈現 Active 群組及其引導空狀態，Parked 群組整段不顯示

### Requirement: 卡片點擊與 hover 動作
卡片 SHALL 可點擊，點擊後開啟該 change 的詳情檢視（右側滑出覆蓋面板，行為見 `artifact-view`；parked 卡片開啟唯讀詳情，行為見 `park-mechanism`）。面板開啟期間再次點擊當前開啟的卡片 SHALL 收合面板。點擊與拖曳為互斥的兩種指標互動，判定規則見「拖曳卡片切換狀態」。hover 時卡片 SHALL 呈現視覺抬升並浮現動作按鈕：active 卡片為 Park、parked 卡片為 Restore；複製名稱與刪除動作仍為後續里程碑範圍，MUST NOT 出現。動作按鈕點擊 MUST NOT 觸發卡片的開啟或收合行為。動作按鈕 SHALL 保留為狀態切換的等價操作（含鍵盤可及路徑），MUST NOT 因拖曳可用而移除。

#### Scenario: 點擊卡片
- **WHEN** 使用者點擊某張卡片
- **THEN** 該 change 的詳情面板自右側滑入，清單維持原位

#### Scenario: 再次點擊當前卡片收合
- **WHEN** 面板開啟於 change A，使用者再次點擊 A 的卡片
- **THEN** 面板收合，畫面回到完整清單

#### Scenario: hover 浮現動作
- **WHEN** 使用者 hover active 卡片
- **THEN** 卡片視覺抬升並浮現 Park 動作按鈕，無複製或刪除按鈕

#### Scenario: 動作點擊不開詳情
- **WHEN** 使用者點擊卡片上的 Park／Restore 按鈕
- **THEN** 執行對應操作，面板不開啟也不收合

#### Scenario: 鍵盤仍可切換狀態
- **WHEN** 使用者以鍵盤聚焦於卡片的 Park 按鈕並按下確認鍵
- **THEN** 執行 park 操作，不需使用拖曳

### Requirement: 拖曳卡片切換狀態
卡片 SHALL 可用拖曳在 Active 與 Parked 兩群組之間搬移，放入對面群組即觸發對應的 park 或 unpark 操作（操作語意與前置條件見 `park-mechanism`）。整張卡片 SHALL 為拖曳來源；卡片上的 Park／Restore 動作按鈕範圍 MUST NOT 啟動拖曳。清單 MUST NOT 為此新增常駐的拖曳把手圖示。

拖曳 SHALL 僅在指標按下後位移超過一個小門檻時啟動；未超過門檻即放開 SHALL 視為點擊並沿用既有的開啟／收合詳情行為。拖曳啟動後，該次指標互動 MUST NOT 觸發詳情的開啟或收合。

由於群組內順序由資料來源決定、清單不提供手動排序，卡片落入群組內的哪個位置 MUST NOT 影響結果：落點的唯一意義是「哪一個群組」。拖曳 MUST NOT 提供群組內重新排序。

#### Scenario: 拖曳 active 卡片至 Parked
- **WHEN** 使用者將 active 卡片拖入 Parked 群組並放手
- **THEN** 觸發該 change 的 park 操作，卡片呈現於 Parked 群組

#### Scenario: 拖曳 parked 卡片至 Active
- **WHEN** 使用者將 parked 卡片拖入 Active 群組並放手
- **THEN** 觸發該 change 的 unpark 操作，卡片呈現於 Active 群組

#### Scenario: 微小位移視為點擊
- **WHEN** 使用者在卡片上按下指標、位移未超過門檻即放開
- **THEN** 該 change 的詳情面板開啟（或收合），不發生任何拖曳或狀態切換

#### Scenario: 拖曳後不開詳情
- **WHEN** 使用者拖曳卡片至對面群組並放手
- **THEN** 執行狀態切換，詳情面板不開啟也不收合

#### Scenario: 動作按鈕不啟動拖曳
- **WHEN** 使用者在卡片的 Park／Restore 按鈕上按下並拖移
- **THEN** 不進入拖曳狀態，卡片不浮起

#### Scenario: 群組內落點不影響結果
- **WHEN** 使用者將 active 卡片放在 Parked 群組中既有卡片之間的任一位置
- **THEN** 結果與放在該群組任何其他位置相同，卡片依 Parked 群組既有排序規則呈現

### Requirement: 拖曳中的落點與原位標示
拖曳啟動時，系統 SHALL 立即標示該卡片唯一的合法目的地群組，MUST NOT 要求指標先移入該群組才顯示標示。來源群組 MUST NOT 被標示為目的地。

目的地標示 MUST NOT 造成任何版面位移——標示 MUST NOT 改變群組內卡片的位置或尺寸。群組內有卡片時標示 SHALL 施加於群組整體範圍；群組為空時，該群組的空內容區塊本身 SHALL 為標示載體（Parked 為落點區塊、Active 為空狀態說明區塊，見「空狀態」），此時 MUST NOT 另外疊加群組範圍標示（同一群組同時出現兩層標示為不允許）。

拖曳期間，被拖走的原位置 SHALL 顯示一個凹槽佔位，其高度 SHALL 等於被拖走卡片的實際高度（卡片高度不一致，見「change 卡片內容」），位置 SHALL 固定不動直到拖曳結束。凹槽 SHALL 在視覺上可與真實卡片區分。

#### Scenario: 拿起即顯示目的地
- **WHEN** 使用者在 active 卡片上啟動拖曳，指標尚未離開 Active 群組範圍
- **THEN** Parked 群組已呈現目的地標示

#### Scenario: 來源群組不標示
- **WHEN** 拖曳進行中，指標位於來源群組上方
- **THEN** 來源群組無目的地標示，僅對面群組有標示

#### Scenario: 標示不造成版面位移
- **WHEN** 目的地群組（內有卡片）出現標示
- **THEN** 該群組內卡片的位置與尺寸與標示前完全相同

#### Scenario: 空群組只有單層標示
- **WHEN** 目的地群組為空且出現標示
- **THEN** 畫面僅呈現一層標示（空落點區塊本身），不出現兩個嵌套的標示框

#### Scenario: 原位凹槽
- **WHEN** 使用者拖曳某卡片離開其原位置
- **THEN** 原位置顯示與該卡片同高的凹槽佔位，且該凹槽在拖曳期間不移動

### Requirement: 拖曳落地為樂觀移動
放手於合法目的地時，卡片 SHALL 立即呈現於目的地群組，狀態切換操作 SHALL 於背景進行，MUST NOT 令使用者等待操作完成才看到卡片落位。操作進行中的卡片 SHALL 有可辨識的進行中標示。

操作失敗時，卡片 SHALL 以動畫返回原群組的原位置，並顯示失敗提示（提示規則見 `park-mechanism`）。操作成功後，清單 SHALL 以重新載入的實際結果為準，MUST NOT 保留樂觀狀態。

#### Scenario: 放手立即落位
- **WHEN** 使用者放手於合法目的地，搬移操作尚未完成
- **THEN** 卡片已呈現於目的地群組並帶進行中標示，畫面不停留等待

#### Scenario: 操作失敗回滾
- **WHEN** 樂觀落位後，park 操作因目標已有殘留而被拒絕
- **THEN** 卡片返回原群組的原位置，並顯示失敗提示

#### Scenario: 操作成功後以實際結果為準
- **WHEN** 搬移操作成功完成
- **THEN** 清單依重新列舉的結果呈現，該卡片在目的地群組中的位置遵循該群組的排序規則

### Requirement: 拖曳取消與禁用
在來源群組內放手、或在任何非合法目的地放手時，SHALL 視為取消：卡片以動畫返回原位置，MUST NOT 觸發任何狀態切換，且 MUST NOT 呈現為錯誤。

park 不可用時（見 `park-mechanism`「無正常 git 目錄時 park 降級」），卡片拖曳 SHALL 整體關閉：卡片 MUST NOT 進入拖曳狀態，兩群組 MUST NOT 顯示任何落點標示。

#### Scenario: 同群組內放手取消
- **WHEN** 使用者拖曳卡片後在來源群組內放手
- **THEN** 卡片返回原位置，狀態不變，無錯誤提示

#### Scenario: 群組外放手取消
- **WHEN** 使用者拖曳卡片至清單以外的區域放手
- **THEN** 卡片返回原位置，狀態不變，無錯誤提示

#### Scenario: park 不可用時不可拖曳
- **WHEN** 目標專案無正常 `.git/` 目錄，使用者嘗試拖曳卡片
- **THEN** 卡片不浮起、無落點標示出現，狀態不變

### Requirement: 拖曳的動效降級
使用者偏好減少動態效果時，拖曳 SHALL 降級而非關閉——指標帶動卡片的直接操作 MUST NOT 被停用。此時 SHALL 保留純顏色與透明度的變化（原位凹槽、目的地標示、落點區塊底色與文案切換），並 SHALL 移除位移與縮放類效果（拖曳中的卡片放大、返回原位的補間動畫改為即時）。

#### Scenario: 減少動態下仍可拖曳
- **WHEN** 系統偏好為減少動態效果，使用者拖曳卡片
- **THEN** 卡片仍跟隨指標並可完成狀態切換

#### Scenario: 減少動態下的標示保留
- **WHEN** 系統偏好為減少動態效果，拖曳進行中
- **THEN** 原位凹槽與目的地標示照常呈現，卡片不放大，返回原位無補間動畫

### Requirement: 首次載入顯示 skeleton
清單資料首次載入期間，主區 SHALL 顯示 skeleton 卡片（2–3 張），其尺寸 SHALL 對應摘錄佔滿兩行的真實卡片高度。資料到達後 SHALL 替換為真實卡片；由於摘錄的有無與行數會使真實卡片高度不一（見「change 卡片內容」），替換時的版面變化 SHALL 全數源自摘錄區塊自身的高度差——卡片內各區塊 MUST NOT 改變自身尺寸，摘錄區塊之下的區塊 MAY 因該高度差整體位移，且位移量 MUST NOT 超過該高度差。

#### Scenario: 載入空窗
- **WHEN** 清單資料尚未回傳（CLI spawn 進行中）
- **THEN** 主區顯示 skeleton 卡片而非空白或 spinner

#### Scenario: skeleton 含摘錄行
- **WHEN** skeleton 卡片顯示中
- **THEN** 其高度包含兩行摘錄區塊，與摘錄佔滿兩行的真實卡片一致

#### Scenario: 摘錄不足兩行時的替換
- **WHEN** 某 change 的摘錄只佔一行，skeleton 替換為該真實卡片
- **THEN** 摘錄區塊之下的區塊整體上移一行的高度，卡片內無任何區塊改變自身尺寸、也無超出該高度差的額外位移

### Requirement: 手動刷新
主區 SHALL 提供手動 refresh 控制；刷新期間 SHALL 保留既有清單內容、僅於控制項上顯示進行中狀態，MUST NOT 清空清單或改回 skeleton。除掛載時載入一次、手動刷新與變動通知觸發的自動重載（見「變動時自動重載」）外，系統 MUST NOT 自動重新載入。

#### Scenario: 刷新期間保留舊資料
- **WHEN** 使用者觸發 refresh 且新資料尚未回傳
- **THEN** 畫面持續顯示原有卡片，refresh 控制項呈現進行中狀態

### Requirement: 變動時自動重載
收到 gateway 變動通知後，清單 SHALL 自動重新載入。重載期間與完成後 SHALL 保留既有卡片內容——MUST NOT 清空清單、顯示 skeleton 或造成版面跳動，資料有差異時原地更新。自動重載失敗 SHALL 完全靜默：MUST NOT 顯示 toast、banner 或錯誤畫面，既有卡片保留，由下一次通知或手動 refresh 自然重試。

#### Scenario: 外部新增 change
- **WHEN** 外部工具於 `openspec/changes/` 建立新的 change
- **THEN** 清單於短暫延遲後自動出現該卡片，畫面其餘部分不變

#### Scenario: 外部更新任務進度
- **WHEN** 外部工具勾選某 change 的 tasks.md 項目
- **THEN** 該卡片的進度條與 n/m 數字於短暫延遲後自動更新

#### Scenario: 自動重載失敗靜默
- **WHEN** 通知觸發的清單重載因 spawn 或解析失敗
- **THEN** 無任何錯誤提示出現，既有卡片維持顯示

### Requirement: 錯誤呈現分層
錯誤呈現 SHALL 對應 gateway 的三類錯誤：CLI 不可用 → 主區常駐 banner；目標路徑不是 openspec 專案 → 主區明確提示（與「沒有 change」的空狀態可區分）；呼叫或解析失敗 → 自動消失的 toast（保留既有清單內容）。呼叫或解析失敗發生在首次載入、沒有既有清單可保留時，主區 SHALL 於卡片區另外顯示可重試的提示；四種提示（CLI 不可用／非 openspec 專案／載入失敗／無 change 空狀態）的文案 SHALL 互相可區分。本需求的失敗提示適用於掛載首次載入與手動刷新；變動通知觸發的自動重載失敗 SHALL 依「變動時自動重載」完全靜默。

#### Scenario: CLI 不可用
- **WHEN** gateway 回報 CLI 不可用
- **THEN** 主區顯示常駐 banner 說明問題

#### Scenario: 路徑不是 openspec 專案
- **WHEN** gateway 回報目標路徑不是 openspec 專案
- **THEN** 主區顯示明確提示，且其文案與「專案內無 change」的空狀態不同

#### Scenario: 暫時性失敗
- **WHEN** 已有清單顯示中且一次手動 refresh 因 spawn 或解析失敗
- **THEN** 顯示自動消失的 toast，既有卡片不消失

#### Scenario: 首次載入即失敗
- **WHEN** 首次載入因 spawn 或解析失敗，畫面沒有任何既有清單可保留
- **THEN** 卡片區顯示可重試的提示（文案與空狀態、非 openspec 專案提示均不同），toast 仍照暫時性失敗規則出現

### Requirement: 空狀態
目標專案為有效 openspec 專案時，無卡片的群組 SHALL 顯示該群組的空狀態內容（英文），MUST NOT 顯示 skeleton 或錯誤。

Active 群組為空時 SHALL 呈現既有的空狀態說明區塊（含圖示與文案）。其文案 SHALL 隨是否存在 parked change 而異：存在時 SHALL 同時涵蓋兩種取得 change 的途徑（以 openspec CLI 建立、自 Parked 群組拖回）；不存在時 MUST NOT 提及拖回——該狀態下無任何卡片可拖，提及即為無效指引。

Parked 群組為空且 Active 群組有卡片時，SHALL 呈現一個落點區塊，並依狀態區分三種呈現：park 可用且未拖曳中為低強度的常駐提示；拖曳中且為目的地時提升對比並改為放手動作語意的文案；park 不可用時（見 `park-mechanism`）呈現不可用樣式、說明不可用原因（沿用該降級提示文案），且 MUST NOT 接受拖曳落點。兩群組皆空時該區塊 MUST NOT 呈現（見「群組、排序與恆常呈現」）。

空群組的內容區塊 SHALL 自身作為目的地標示的載體：成為拖曳目的地時，由該區塊自己的邊框與底色改變來表達標示，MUST NOT 於其外層另加一層標示框——兩種空群組內容（Active 的說明區塊、Parked 的落點區塊）本身都已具備邊框，外加標示會使畫面出現兩層嵌套框而無從判斷落點。

#### Scenario: 無進行中 change
- **WHEN** Active 群組回傳 0 筆且無錯誤
- **THEN** 主區顯示 Active 空狀態說明（英文），不顯示 skeleton 或錯誤

#### Scenario: 有 parked 時文案涵蓋拖回
- **WHEN** Active 群組為空且存在至少一個 parked change
- **THEN** 其文案同時說明可用 openspec CLI 建立 change，以及可自 Parked 群組拖回

#### Scenario: 無 parked 時文案不提拖回
- **WHEN** Active 與 Parked 群組皆為空
- **THEN** 其文案只說明可用 openspec CLI 建立 change，不提及拖回

#### Scenario: Active 說明區塊作為落點只有單層標示
- **WHEN** 使用者拖曳 parked 卡片，Active 群組為空且其說明區塊成為目的地
- **THEN** 該區塊自身的邊框與底色改變以表達標示，畫面不出現兩層嵌套的標示框

#### Scenario: Parked 空落點常駐提示
- **WHEN** park 可用、Parked 群組無卡片且無拖曳進行中
- **THEN** Parked 群組顯示低強度的落點提示區塊

#### Scenario: Parked 空落點拖曳中強調
- **WHEN** Parked 群組為空且成為拖曳的目的地
- **THEN** 該落點區塊提升對比，文案改為放手動作語意

#### Scenario: park 不可用時的空落點
- **WHEN** 目標專案無正常 `.git/` 目錄
- **THEN** Parked 群組的落點區塊呈不可用樣式並說明原因，拖曳落點不被接受

### Requirement: 側欄靜態殼
側欄 SHALL 呈現四段結構（Logo＋App 名／專案清單／Specs 與 Archived 入口／Settings）；專案清單段 SHALL 為可互動的多專案清單，其行為（列項、切換、加入、移除、徽章）由 project-management capability 規範。Specs 與 Archived 項 SHALL 可互動：點擊將主區切換至對應頁（頁內容分別由 specs-view 與 archived-view capability 規範），且主區為該頁時對應項 SHALL 高亮標示當前頁；主區為 Changes 頁時 nav 段 MUST NOT 有高亮項（以專案清單段的目前專案標記兼任位置指示），nav 段 MUST NOT 另設 Changes 項。Archived 項的文字 SHALL 為「Archived」（MUST NOT 沿用「Archive」）。Settings 項 MUST NOT 具備功能（點擊無反應），且 MUST NOT 以灰化樣式呈現。

#### Scenario: 專案徽章
- **WHEN** 目前專案有 3 個進行中 change
- **THEN** 側欄清單中目前專案項的徽章顯示 3（多專案徽章行為詳見 project-management）

#### Scenario: 切至 Specs 頁
- **WHEN** 使用者在 Changes 頁點擊側欄 Specs 項
- **THEN** 主區切換為 Specs 頁，Specs 項高亮

#### Scenario: 切至 Archived 頁
- **WHEN** 使用者在 Changes 頁點擊側欄 Archived 項
- **THEN** 主區切換為 Archived 頁，Archived 項高亮

#### Scenario: 死項點擊
- **WHEN** 使用者點擊 Settings
- **THEN** 無任何反應（無導航、無錯誤）
