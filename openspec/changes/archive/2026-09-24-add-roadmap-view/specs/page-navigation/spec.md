# Spec Delta

## MODIFIED Requirements

### Requirement: 麵包屑呈現
主區四頁（Changes／Specs／Archived／Roadmap）的頁首 SHALL 呈現麵包屑，含兩段：目標專案名與當前頁名。專案段 SHALL 為純標籤，MUST NOT 可互動——專案切換的唯一入口是側欄的專案清單。麵包屑 SHALL 與該頁的手動刷新控制項同處一行，佔據原本頁標的位置，MUST NOT 另闢一行。Specs、Archived 與 Roadmap 頁的項目數量 SHALL 隨麵包屑呈現（Roadmap 為規劃檔總數，含各組）；Changes 頁 MUST NOT 於麵包屑呈現數量，其 Active 與 Parked 的數量各由所屬群組標題承擔。

#### Scenario: 專案身分與當前頁
- **WHEN** 目標專案為 `specrun-app` 且主區在 Specs 頁
- **THEN** 頁首麵包屑呈現專案名 `specrun-app` 與當前頁 `Specs`，並顯示 spec 數量

#### Scenario: Roadmap 頁的數量
- **WHEN** 主區在 Roadmap 頁，目標專案有 18 個規劃檔，分屬四組
- **THEN** 麵包屑顯示 18

#### Scenario: 專案段不可互動
- **WHEN** 使用者點擊麵包屑的專案名
- **THEN** 無任何反應，主區維持在原本的頁

#### Scenario: Changes 頁的數量歸屬
- **WHEN** 主區在 Changes 頁且有 2 個 active、1 個 parked change
- **THEN** 麵包屑不顯示任何數量，`Active` 與 `Parked` 群組標題各自顯示 2 與 1

### Requirement: 頁切換下拉
麵包屑的當前頁名 SHALL 為下拉的觸發項。下拉展開時 SHALL 列出全部四頁（Changes／Specs／Archived／Roadmap，依此順序）並標示當前頁，MUST NOT 只列出非當前頁的項目。選定非當前頁 SHALL 將主區切換至該頁；選定當前頁 SHALL 僅關閉下拉，MUST NOT 觸發該頁重新載入。下拉 MUST NOT 呈現各頁的項目數量——取得 Specs、Archived 與 Roadmap 的數量需預先載入其資料，與這三頁「進頁載入、離頁清空」的既有生命週期相斥。

#### Scenario: 展開列出三項
- **WHEN** 使用者在 Specs 頁展開頁切換下拉
- **THEN** 下拉列出的項目包含 Changes、Specs、Archived 三項且 Specs 被標示為當前頁；完整清單另含 Roadmap，見「展開列出四項」

#### Scenario: 展開列出四項
- **WHEN** 使用者在 Specs 頁展開頁切換下拉
- **THEN** 下拉依序列出 Changes、Specs、Archived、Roadmap 四項，且 Specs 被標示為當前頁

#### Scenario: 切換至他頁
- **WHEN** 使用者在 Changes 頁的下拉中選定 Archived
- **THEN** 主區切換為 Archived 頁，麵包屑當前頁名更新為 Archived

#### Scenario: 切換至 Roadmap
- **WHEN** 使用者在 Changes 頁的下拉中選定 Roadmap
- **THEN** 主區切換為 Roadmap 頁，麵包屑當前頁名更新為 Roadmap

#### Scenario: 選定當前頁
- **WHEN** 使用者在 Specs 頁的下拉中選定 Specs
- **THEN** 下拉關閉，主區維持在 Specs 頁且不重新載入清單

### Requirement: 無目標專案時不呈現
無目標專案時，麵包屑整條 MUST NOT 呈現，與該狀態下頁首其他控制項一致。因此無目標專案時 MUST NOT 存在任何進入 Specs、Archived 或 Roadmap 頁的路徑——該狀態下這三頁只有與 Changes 頁相同的空狀態引導。加入專案後主區 SHALL 落在 Changes 頁。

#### Scenario: 無專案
- **WHEN** 專案清單為空
- **THEN** 主區不呈現麵包屑與刷新控制項，只呈現加入專案的空狀態引導

#### Scenario: 加入專案後
- **WHEN** 使用者自空狀態加入一個專案
- **THEN** 主區落在 Changes 頁，麵包屑呈現該專案名與當前頁 `Changes`
