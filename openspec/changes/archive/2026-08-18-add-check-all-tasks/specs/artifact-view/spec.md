## ADDED Requirements

### Requirement: tasks 全部勾選
tasks artifact tab SHALL 提供一個批次勾選入口，一次將當前 tasks 檔案中所有未勾選的 task 行標記為完成；已勾選的項目 MUST NOT 因此變動。批次為單向操作：系統 MUST NOT 提供「全部取消勾選」的反向入口，亦 MUST NOT 提供批次的復原（undo）——個別項目仍可由使用者單點改回。

入口 SHALL 與 artifact tabs 同列並置於該列右端，且 SHALL 位於不隨 artifact 內容捲動的區域——tasks 內容捲至任何位置時入口皆保持可見。入口 SHALL 標示文字，MUST NOT 僅以圖示呈現。

入口的出現條件 SHALL 與該 tab 內 checkbox 可互動的條件同源：唯有非 parked change、當前 tab 為 tasks、且該 artifact 恰有單一檔案時才出現；任一條件不成立時入口 MUST NOT 出現（唯讀情境下 MUST NOT 出現任何批次寫入入口）。當前 tasks 檔案已無未勾選項（含完全沒有 task 行的情形）時，入口 SHALL 呈現為停用狀態，MUST NOT 隱藏。

#### Scenario: 一次勾完剩餘項目
- **WHEN** tasks 檔案有 10 個 task 行、其中 3 個已勾選，使用者觸發批次勾選
- **THEN** 其餘 7 行全部標記為完成，原已勾選的 3 行不變，寫入以單次請求完成

#### Scenario: 捲動後仍可觸發
- **WHEN** 使用者將 tasks 內容捲動至底部
- **THEN** 批次勾選入口仍在畫面上可見且可觸發，MUST NOT 需要先捲回頂端

#### Scenario: 全部已完成時停用
- **WHEN** 當前 tasks 檔案的所有 task 行皆已勾選
- **THEN** 批次勾選入口仍在原位但呈現停用，觸發它不產生任何寫入請求

#### Scenario: 非 tasks tab 不出現
- **WHEN** 使用者切換至 proposal、design 或 specs 等其他 artifact tab
- **THEN** 批次勾選入口不出現，且該列其他控制項的位置 MUST NOT 因此位移

#### Scenario: parked change 不出現
- **WHEN** 使用者檢視 parked change 的 tasks tab
- **THEN** 批次勾選入口不出現，該份 tasks 維持整份唯讀

### Requirement: 批次勾選的樂觀更新與失敗彈回
批次勾選 SHALL 採與單顆點擊一致的樂觀更新——觸發當下所有目標項目立即呈現已勾選，MUST NOT 等待寫入完成。批次寫入進行中 SHALL 鎖定該批次涵蓋的項目與入口本身，忽略對它們的再次觸發；寫入成功後 MUST NOT 額外提示，後續刷新由既有變動通知機制吸收。

批次寫入失敗時，該批次涉及的所有項目 SHALL 一併彈回寫入前的狀態，MUST NOT 留下部分項目已勾、部分未勾的畫面；並 SHALL 以非阻斷提示（toast）告知，衝突（目標行已被外部修改）與其他失敗的文案 SHALL 可區分。失敗 MUST NOT 以錯誤畫面打斷閱讀。

#### Scenario: 立即全部翻轉
- **WHEN** 使用者觸發批次勾選
- **THEN** 所有未勾選項目立即顯示為已勾選，不出現載入等待，寫入於背景完成

#### Scenario: 進行中不重複觸發
- **WHEN** 批次寫入尚未完成，使用者再次觸發入口或點擊該批次涵蓋的任一 checkbox
- **THEN** 該次操作無任何效果，不產生第二次寫入請求

#### Scenario: 批次衝突整片彈回
- **WHEN** 批次寫入因其中某一行已被外部修改而遭放棄
- **THEN** 該批次涉及的項目全部彈回觸發前的狀態，出現衝突語意的 toast，內容隨變動通知更新為最新版本

#### Scenario: 批次一般寫入失敗
- **WHEN** 批次寫入因 IO 或通道錯誤失敗
- **THEN** 該批次涉及的項目全部彈回原狀態，出現與衝突可區分的失敗 toast，詳情畫面不被錯誤畫面取代
