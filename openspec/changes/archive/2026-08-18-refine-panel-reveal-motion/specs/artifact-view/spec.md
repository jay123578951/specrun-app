## MODIFIED Requirements

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

#### Scenario: 點擊露出卡片切換
- **WHEN** 面板開啟於 change A，使用者點擊露出區內 change B 的卡片
- **THEN** 面板內容原地更新為 B，B 卡片高亮，面板不收合

#### Scenario: 原地換內容淡入
- **WHEN** 面板開啟於 change A，使用者切換至 change B
- **THEN** 面板捲動內容區以短淡入呈現 B 的內容，面板外殼不動、不重新進場

#### Scenario: 身分回饋即時
- **WHEN** 使用者切換至另一個 change
- **THEN** header 的 change 名稱與該卡片的高亮立即更新，不隨內容淡入延後

#### Scenario: 連續快速切換不排隊
- **WHEN** 使用者按住 ↓ 鍵連續切換多個 change
- **THEN** 面板直接顯示最新一個 change 的內容，不排隊播放中間各次的過場，也不出現內容延遲

#### Scenario: 鍵盤切換
- **WHEN** 面板開啟時使用者按 ↓ 鍵
- **THEN** 切換至清單順序的下一個 change，行為與點擊一致
