## MODIFIED Requirements

### Requirement: task 勾選寫入通道
gateway SHALL 提供翻轉 task 勾選狀態的寫入方法——App 的唯一寫入通道。單次寫入請求 SHALL 可指定一個或多個目標行，全部目標行 SHALL 落在同一份 tasks 檔案；單顆 checkbox 的點擊即為只帶一個目標行的情形，MUST NOT 另闢第二條寫入通道。多個目標行的寫入 SHALL 以單次讀取、單次寫回完成，MUST NOT 逐行分次寫檔。寫入 SHALL 為檔案層操作，MUST NOT 經 openspec CLI 改寫內容；進度數字仍由引擎於後續讀取時重算，系統 MUST NOT 自行推導。寫入目標 SHALL 由當前執行形態以 CLI 回傳的 tasks artifact `artifactPaths` 解析，MUST NOT 信任呼叫端提供的檔案路徑；tasks artifact 以外的檔案 MUST NOT 可經此通道寫入。

不含任何目標行的寫入請求 SHALL 被拒絕並回報失敗，MUST NOT 讀取或寫入任何檔案——沒有目標行的寫入沒有可觀察的意義，照常執行只會把原樣內容再寫回一次。

解析結果若被重用以省去重複的 CLI 呼叫，該重用 SHALL 以目標專案與 change 名**共同**識別，MUST NOT 僅以 change 名識別——不同專案可有同名 change，只以 change 名識別會把寫入導向另一個專案的檔案。切換目標專案後對同名 change 的寫入 SHALL 落在切換後的專案。

重用前 SHALL 確認目標專案仍可達，且 SHALL 確認先前解析所指的檔案仍然存在；任一項不成立即 SHALL 重新解析，MUST NOT 沿用過期的結果寫入。確認檔案是否存在的通道自己失敗時 SHALL 視同檔案已不在而重新解析——重新問一趟引擎的代價遠低於寫錯檔案。

#### Scenario: 勾選寫入成功
- **WHEN** 呼叫端對某 change 的 tasks 檔案某行發出勾選請求，且該行內容與呼叫端所見一致
- **THEN** 該行的勾選標記翻轉並寫回檔案，回應成功

#### Scenario: 多行一次寫入
- **WHEN** 呼叫端於單次請求中指定同一份 tasks 檔案的 N（N > 1）個目標行，且每一行的內容都與呼叫端所見一致
- **THEN** N 行的勾選標記在一次檔案寫入中全部翻轉，回應成功，且該檔案 MUST NOT 被寫入超過一次

#### Scenario: 路徑由伺服端解析
- **WHEN** 呼叫端發出勾選請求（僅含 change 名稱、目標行號與各行原文）
- **THEN** 當前執行形態自行解析 tasks artifact 的檔案路徑後寫入，呼叫端無從指定任意路徑

#### Scenario: 非 tasks 檔案拒絕寫入
- **WHEN** 勾選請求的目標 change 其 tasks artifact 無既存檔案
- **THEN** 寫入被拒絕並回報錯誤，不寫入任何其他檔案

#### Scenario: 同名 change 不跨專案串線
- **WHEN** 使用者先於專案 A 對某 change 勾選成功，接著切換到同樣含有同名 change 的專案 B，對該 change 發出勾選請求
- **THEN** 寫入落在專案 B 的該 change tasks 檔案，專案 A 的檔案 MUST NOT 被改動

#### Scenario: 沒有目標行的請求
- **WHEN** 寫入請求不含任何目標行
- **THEN** 請求被拒絕並回報失敗，MUST NOT 讀取或寫入任何檔案

#### Scenario: 重用前目標專案已不可達
- **WHEN** 先前已解析過某 change 的 tasks 檔案位置，其後目標專案資料夾不可達（外接碟未掛載、路徑被改名），使用者對該 change 發出勾選請求
- **THEN** 回報「取不到目標專案」的失敗，MUST NOT 沿用先前解析的路徑寫入

#### Scenario: 重用所指的檔案已不在
- **WHEN** 先前解析所指的 tasks 檔案已不存在（或該確認本身無法完成），使用者對該 change 發出勾選請求
- **THEN** 重新向引擎解析一次檔案位置後再寫入
