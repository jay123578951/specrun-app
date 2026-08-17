## ADDED Requirements

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

## REMOVED Requirements

### Requirement: 群組與排序

**Reason**: 「無 parked change 時 Parked 群組 SHALL 整段隱藏」的行為被本 change 推翻——拖曳切換狀態需要恆常存在的落點，隱藏空群組會使首次以拖曳 park 永無可能成立。該需求的其餘內容（兩群組同頁、各自的排序規則）仍然有效。
**Migration**: 由本 delta 的「群組、排序與恆常呈現」取代，排序規則原文保留。

## MODIFIED Requirements

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
