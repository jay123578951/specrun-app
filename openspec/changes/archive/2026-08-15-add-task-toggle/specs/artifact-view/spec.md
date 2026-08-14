## MODIFIED Requirements

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

## ADDED Requirements

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
