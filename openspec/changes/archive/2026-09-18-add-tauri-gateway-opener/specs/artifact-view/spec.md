## MODIFIED Requirements

### Requirement: 連結行為

渲染內容中的外部 URL 連結 SHALL 於系統的預設瀏覽器開啟（在瀏覽器中執行時為新分頁）；相對路徑連結 SHALL 渲染為非互動樣式，點擊無反應（artifact 互跳與編輯器開啟為刻意延後範圍）。

外部連結的點擊 SHALL 由 App 自己接住後交給當前執行形態開啟，MUST NOT 依賴執行環境對連結的預設處理——桌面視窗形態不處理「開新視窗」，依賴它等於點下去什麼都不會發生。

各執行形態 SHALL 走同一條開啟路徑，且點擊 MUST NOT 因鍵盤修飾鍵（如 Cmd／Ctrl）而改走執行環境的原生處理——形態之間的行為差異不得由使用者按了什麼鍵決定。

可被視為外部連結的 URL SHALL 限於 http、https 與 mailto；其餘 SHALL 比照相對路徑連結，渲染為非互動樣式。

scheme 的比對 SHALL 不分大小寫，且交給執行形態開啟之前 SHALL 先將 scheme 正規化為小寫；URL 的其餘部分 MUST NOT 被更動（路徑與查詢字串的大小寫在某些伺服器上有意義）。正規化後仍不在允許範圍內的 URL MUST NOT 被交給執行形態。

開啟失敗時 SHALL 以非阻斷提示（toast）告知，MUST NOT 靜默——靜默與「這個連結本來就不能點」在畫面上分不出來。失敗 MUST NOT 以錯誤畫面打斷閱讀，既有內容維持顯示。

外部連結開啟後，App 當前檢視的 change、artifact tab 與內容捲動位置 SHALL 維持不變。

#### Scenario: 外部連結

- **WHEN** 使用者點擊內容中的 https 連結
- **THEN** 連結於系統的預設瀏覽器開啟（在瀏覽器中執行時為新分頁），App 畫面不變

#### Scenario: 桌面視窗形態的外部連結

- **WHEN** 以桌面視窗形態檢視 artifact，使用者點擊內容中的 https 連結
- **THEN** 該網址於系統的預設瀏覽器開啟，MUST NOT 在 App 視窗內開啟，也 MUST NOT 毫無反應

#### Scenario: 按修飾鍵點擊不改道

- **WHEN** 使用者按著 Cmd 或 Ctrl 點擊內容中的 https 連結
- **THEN** 行為與一般點擊相同，仍由 App 接住後交給當前執行形態開啟

#### Scenario: 開啟失敗

- **WHEN** 使用者點擊一個外部連結，而系統開不起來
- **THEN** 出現非阻斷提示說明開不起來，正在檢視的內容維持顯示，MUST NOT 毫無反應

#### Scenario: 開啟後檢視狀態不變

- **WHEN** 使用者在某 change 的某個 artifact tab 捲到中段後點擊一個外部連結
- **THEN** 開啟動作完成後，仍停在同一個 change、同一個 tab、同一個捲動位置

#### Scenario: 相對路徑連結

- **WHEN** 內容含指向 ./design.md 的相對連結且使用者點擊
- **THEN** 無任何導航或開啟行為發生

#### Scenario: 大小寫不同的 scheme

- **WHEN** 內容含 `HTTPS://example.com` 這類 scheme 為大寫或混合大小寫的連結且使用者點擊
- **THEN** 行為與小寫 scheme 的同一網址相同，於系統的預設瀏覽器開啟；交給執行形態的網址其 scheme 已為小寫，路徑部分的大小寫維持原樣

#### Scenario: 允許範圍以外的 scheme

- **WHEN** 內容含 `file:` 或 `javascript:` 開頭的連結
- **THEN** 該連結渲染為非互動樣式，點擊無任何導航或開啟行為發生
