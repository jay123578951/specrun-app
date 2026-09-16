## ADDED Requirements

### Requirement: 詳情面板顯示建立時刻
詳情面板 header SHALL 顯示所檢視 change 的建立時刻，位置在收合控制與動作控制所在的那一列、動作控制群組之前（即緊鄰複製名稱控制的外側）。文案 SHALL 為 `Created ` 接不含年份的月日與時分（如 `Created 09-15 16:38`），時分 SHALL 為 24 小時制。滑鼠停留於該欄位時 SHALL 提供含年份的完整時刻（如 `2026-09-15 16:38`）——省略年份是為版面精簡，跨年後的判讀須仍有出處。

該欄位 MUST NOT 呈現為可互動元素：MUST NOT 可聚焦、MUST NOT 有 hover 或 press 的外觀變化、MUST NOT 帶邊框或按鈕底色。其文字對比 SHALL 明顯低於同列的動作控制，與動作控制群組的間距 SHALL 大於動作控制彼此之間的間距——它坐落於一排可點擊的圖示旁，必須一眼讀得出是說明文字而非尚未啟用的按鈕。

active 與 parked 兩種 change 的詳情面板 SHALL 一致顯示此欄位。建立時刻取不到時（來源未提供或讀取失敗），面板 MUST NOT 顯示該欄位、MUST NOT 保留佔位、也 MUST NOT 呈現為錯誤或缺件提示。

歸檔詳情面板 MUST NOT 顯示此欄位；其 header 排版與本面板的同構關係 SHALL 維持。

檢視中的 change 被 park 或 unpark 時，面板本就會關閉（見「檢視中 change 消失自動關閉」）。在清單更新落地到面板關閉之間的短暫過渡，建立時刻欄位 SHALL 先行消失，其後面板整個關閉——此過渡 SHALL 為可接受行為，MUST NOT 於該期間顯示錯誤或缺件提示。

#### Scenario: active change 的詳情顯示建立時刻
- **WHEN** 使用者點開某 active change 的卡片，該 change 建立於 2026-09-15 16:38
- **THEN** 面板 header 的控制列顯示「Created 09-15 16:38」，位置在複製名稱控制之外側

#### Scenario: parked change 的詳情同樣顯示
- **WHEN** 使用者點開某 parked change 的卡片
- **THEN** 面板以與 active change 相同的位置與文案顯示其建立時刻

#### Scenario: 滑鼠停留取得含年份的完整值
- **WHEN** 使用者將指標停留於建立時刻欄位
- **THEN** 顯示含年份的完整時刻

#### Scenario: 不被誤認為可點擊控制
- **WHEN** 使用者將指標移入建立時刻欄位
- **THEN** 該欄位不出現任何 hover 外觀變化、不可點擊、不可由鍵盤聚焦

#### Scenario: 取不到建立時刻時整欄不出現
- **WHEN** 某 change 的建立時刻無法取得
- **THEN** 面板 header 不顯示該欄位、不留空白佔位、不顯示錯誤或缺件提示

#### Scenario: 檢視中的 change 被 park 的過渡
- **WHEN** 使用者正開著某 active change 的詳情面板，該 change 於此時被 park
- **THEN** 建立時刻欄位先消失、面板隨即關閉，過渡期間不顯示錯誤或缺件提示

#### Scenario: 歸檔詳情不顯示建立時刻
- **WHEN** 使用者於歸檔頁點開某已歸檔 change
- **THEN** 其詳情面板 header 不含建立時刻欄位
