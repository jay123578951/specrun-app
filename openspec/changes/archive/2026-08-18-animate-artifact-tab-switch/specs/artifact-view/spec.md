## ADDED Requirements

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

## MODIFIED Requirements

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
