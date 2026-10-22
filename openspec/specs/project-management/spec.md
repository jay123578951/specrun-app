# project-management Specification

## Purpose

多專案的清單管理與切換：加入／移除／切換專案、清單的持久化、路徑驗證與失效語意、每專案徽章的弱一致刷新，以及空清單的引導。

## Requirements

### Requirement: 專案清單持久化
系統 SHALL 將專案清單（各專案路徑及其先後順序）與最後啟用專案持久化於平台慣例的應用程式設定位置；App 重啟後清單 SHALL 依存下的順序完整還原。新加入的專案 SHALL 接在清單最後面。設定資料損毀或無法解析時，系統 SHALL 視為空清單重建，MUST NOT 因此無法啟動。

#### Scenario: 重啟還原
- **WHEN** 使用者加入兩個專案後重啟 App
- **THEN** 側欄專案清單仍列出該兩個專案

#### Scenario: 重啟後順序不變
- **WHEN** 使用者把清單中最後一個專案移到最上面後重啟 App
- **THEN** 側欄專案清單的順序與重啟前相同，該專案仍在最上面

#### Scenario: 新加入的專案接在最後
- **WHEN** 清單已有三個專案，使用者加入第四個
- **THEN** 第四個專案出現在清單最後面，原本三個專案的先後不變

#### Scenario: 設定損毀
- **WHEN** 設定資料被外部改壞（無法解析）
- **THEN** App 正常啟動並呈現空清單引導，不顯示崩潰或無法操作的錯誤

### Requirement: 加入專案
系統 SHALL 以作業系統原生資料夾選擇 dialog 作為加入專案的唯一入口（能力由當前執行形態判定並回報，前端 MUST NOT 寫死），且 MUST NOT 提供手打或貼上路徑的替代輸入。使用者選定資料夾後 SHALL 驗證該路徑為既存資料夾且含 `openspec/` 目錄，驗證失敗 SHALL 以 toast 明確提示且不加入清單；加入成功 SHALL 立即切換至該專案，並進入該專案的 Changes 主頁（主區若在 Specs 等其他頁則回到 Changes 頁）。以 canonical 路徑比對已存在於清單的專案時，系統 MUST NOT 重複加入，SHALL 以 toast 提示已存在並直接切換過去。

使用者取消選擇 SHALL 不產生任何變化與提示。當前執行形態不具備原生選資料夾能力（如該形態所在平台不支援）或 dialog 開啟失敗時，SHALL 以 toast 說明無法開啟選擇器，清單不變。

各處的加入入口（側欄與各頁空狀態）SHALL 走同一套流程，行為一致。

#### Scenario: 以 dialog 加入
- **WHEN** 使用者點擊加入專案入口並在 dialog 中選定一個含 `openspec/` 目錄的資料夾
- **THEN** 該專案出現在清單中並成為目前專案，主區顯示其 change 清單

#### Scenario: dialog 中取消
- **WHEN** 使用者點擊加入專案入口開啟 dialog 後取消選擇
- **THEN** 清單與目前專案不變，介面不顯示任何錯誤與任何輸入欄位

#### Scenario: dialog 選到無效資料夾
- **WHEN** 使用者在 dialog 中選定一個不含 `openspec/` 目錄的資料夾
- **THEN** 以 toast 顯示明確的驗證失敗提示，清單不變

#### Scenario: 重複加入
- **WHEN** 使用者選定的資料夾（canonical 化後）已在清單中
- **THEN** 不新增項目，以 toast 提示已存在並切換至該專案

#### Scenario: 不具能力或開啟失敗
- **WHEN** 當前執行形態不具備原生選資料夾能力，或回報具備能力但 dialog 實際開啟失敗
- **THEN** 以 toast 說明無法開啟選擇器，清單不變，介面不出現任何路徑輸入欄位

#### Scenario: 空狀態的加入入口
- **WHEN** 清單為空、使用者點擊主區空狀態的加入專案按鈕
- **THEN** 開啟同一個原生 dialog，後續行為與側欄入口完全相同

#### Scenario: 選擇流程未回傳可用路徑
- **WHEN** 選擇流程結束卻取不到可用的資料夾路徑（例如等待選擇結果的通道非正常關閉，或選定的項目無法解析成路徑）
- **THEN** 視同 dialog 開啟失敗處理，以 toast 說明無法開啟選擇器，清單不變

#### Scenario: 選到名稱含無法解讀位元組的資料夾
- **WHEN** 使用者選定的資料夾路徑含無法以文字解讀的位元組
- **THEN** 該路徑以替代字元有損轉換後繼續走驗證，MUST NOT 在此階段直接拒絕；驗證因路徑指不到既存資料夾而失敗，以 toast 提示該路徑不是既存資料夾，清單不變

#### Scenario: 在 Specs 頁加入專案
- **WHEN** 主區在 Specs 頁，使用者加入並切換至另一個專案
- **THEN** 主區顯示新專案的 Changes 主頁，不停留在 Specs 頁顯示前一個專案的 spec 清單

### Requirement: 移除專案
清單項 SHALL 提供移除操作，移除前 SHALL 經確認，確認文案 SHALL 講明只將專案移出清單、不動磁碟上的任何檔案。移除目前專案時，系統 SHALL 切換至清單第一個專案，並進入該專案的 Changes 主頁（主區若在 Specs 等其他頁則回到 Changes 頁）；清單因此變空時 SHALL 進入空清單引導。

#### Scenario: 移除非目前專案
- **WHEN** 使用者對非目前專案觸發移除並確認
- **THEN** 該項自清單消失，目前專案與主區內容不變，磁碟檔案不受影響

#### Scenario: 移除目前專案
- **WHEN** 使用者移除目前專案且清單尚有其他專案
- **THEN** 系統切換至清單第一個專案並載入其資料

#### Scenario: 移除至清單全空
- **WHEN** 使用者移除清單中最後一個專案
- **THEN** 主區顯示空清單引導（引導加入專案）

#### Scenario: 在 Specs 頁移除目前專案
- **WHEN** 主區在 Specs 頁，使用者移除目前專案且清單尚有其他專案
- **THEN** 主區顯示接手專案的 Changes 主頁，不停留在 Specs 頁

### Requirement: 切換專案
點擊側欄專案清單中的專案項 SHALL 一律進入該專案的 Changes 主頁：點擊非目前專案 SHALL 切換過去，主區 SHALL 顯示新專案的 change 清單（已開啟的詳情視圖關閉、若在 Specs 等其他頁則回到 Changes 頁），資料 SHALL 全部來自新專案，切換後最後啟用專案的持久化紀錄 SHALL 更新；點擊目前專案時，若主區不在 Changes 頁 SHALL 回到 Changes 頁（已開啟的詳情視圖關閉），已在 Changes 頁則 SHALL 無任何反應。切換至路徑已失效的專案時，SHALL 以既有的「路徑不存在」錯誤語意呈現；系統 MUST NOT 以背景輪詢方式預先偵測清單中各專案的失效。

#### Scenario: 切換成功
- **WHEN** 使用者在詳情視圖開啟時點擊另一個專案
- **THEN** 詳情關閉、主區顯示新專案的 change 清單，側欄目前專案標示移至新專案

#### Scenario: 從 Specs 頁點目前專案回主頁
- **WHEN** 主區在 Specs 頁，使用者點擊側欄的目前專案
- **THEN** 主區回到 Changes 頁，專案不變

#### Scenario: 從 Specs 頁切換到另一個專案
- **WHEN** 主區在 Specs 頁，使用者點擊另一個專案
- **THEN** 主區顯示新專案的 Changes 主頁（不停留在 Specs 頁）

#### Scenario: 已在主頁點目前專案
- **WHEN** 主區在 Changes 頁，使用者點擊目前專案
- **THEN** 無任何反應（不重載、無錯誤）

#### Scenario: 切換到已失效的專案
- **WHEN** 清單中某專案的資料夾已被移走，使用者點擊它
- **THEN** 切換發生且主區以「路徑不存在」錯誤呈現，其他專案不受影響

### Requirement: 每專案徽章弱一致
清單每項 SHALL 掛徽章顯示該專案未 archive 的 change 數。徽章 SHALL 於 App 啟動時刷新一輪、並於每次切換專案時刷新；目前專案的徽章 SHALL 隨其變動通知即時更新；非目前專案的變動 MAY 延遲至下次刷新時機才反映。無法取得數字的專案（路徑失效、CLI 失敗）MUST NOT 顯示編造的數字。

#### Scenario: 啟動刷新
- **WHEN** App 啟動且清單有三個專案
- **THEN** 各項徽章顯示各自專案當下的未 archive change 數

#### Scenario: 非目前專案延遲反映
- **WHEN** 外部工具 archive 了非目前專案的一個 change
- **THEN** 該專案徽章允許暫不更新，於下次啟動或切換過去時反映新數字

#### Scenario: 取數失敗不編數字
- **WHEN** 清單中某專案路徑已失效
- **THEN** 該項不顯示數字徽章

### Requirement: 覆寫與 fallback 為暫時項
啟動時由環境變數覆寫、或由工作目錄 fallback（dogfooding）決定的目標專案若不在持久化清單中，SHALL 以暫時項形式顯示於清單，MUST NOT 自動寫入持久化清單；其後的切換操作 SHALL 照常生效。

#### Scenario: 暫時項顯示
- **WHEN** 以環境變數指定一個不在清單中的專案路徑啟動
- **THEN** 該專案顯示為目前專案，重啟（不帶環境變數）後不出現在清單中

### Requirement: 空清單引導
清單無任何專案時，主區 SHALL 顯示引導加入專案的空狀態，並提供加入入口。

#### Scenario: 首次啟動
- **WHEN** App 首次啟動且無環境變數覆寫、設定中無任何專案、伺服端工作目錄也不是 openspec 專案
- **THEN** 主區顯示引導加入專案的空狀態

### Requirement: 拖曳調整專案順序
使用者 SHALL 能在側欄按住專案項上下拖曳以調整它在清單中的位置。指標按下後移動未超過 5px 就放開 SHALL 視為點擊，照「切換專案」處理；超過後即進入拖曳，拖曳中被拖的專案項 SHALL 跟著指標移動，其他專案項 SHALL 讓出它將落下的位置。放開後 SHALL 停在新位置並寫回持久化清單，且 MUST NOT 觸發切換。從移除鈕按下 MUST NOT 開始拖曳；拖曳中移除鈕 MUST NOT 出現。拖曳後放開的位置與原位相同時，清單順序 SHALL 不變、MUST NOT 寫回，也 MUST NOT 觸發切換。按下後還沒移動超過 5px 就把指標移出專案清單時，這次按下 SHALL 作廢：不切換、不排序，之後沒按著按鍵移回清單 MUST NOT 進入拖曳。

#### Scenario: 拖到最上面
- **WHEN** 清單依序為 A、B、C，使用者按住 C 拖到 A 的上方後放開
- **THEN** 清單變成 C、A、B，目前專案不變，重啟後仍是 C、A、B

#### Scenario: 沒拖動就放開是點擊
- **WHEN** 使用者按住非目前專案 B，移動不到 5px 就放開
- **THEN** 切換到 B，清單順序不變

#### Scenario: 拖曳結束不切換
- **WHEN** 使用者把非目前專案 B 拖到別的位置後放開
- **THEN** B 停在新位置，目前專案不變

#### Scenario: 拖回原位放開
- **WHEN** 使用者拖動 B 超過 5px，最後在原本的位置放開
- **THEN** 清單順序不變、不寫回，目前專案不變

#### Scenario: 還沒拖動就移出清單
- **WHEN** 使用者按住 B，移動不到 5px 就把指標橫向移出側欄放開，之後不按按鍵把指標移回清單上下移動
- **THEN** 不切換專案、清單順序不變，各專案項不位移

#### Scenario: 拖曳中途被系統取消
- **WHEN** 拖曳途中指標被系統收走（例如視窗失去焦點）
- **THEN** 清單維持拖曳前的順序，不寫回

### Requirement: 鍵盤調整專案順序
鍵盤 focus 在專案項上時，按 Alt+↑ SHALL 把該專案往上移一格，按 Alt+↓ SHALL 往下移一格，移動後 SHALL 寫回持久化清單，focus SHALL 留在被移動的專案項上。已在可移動範圍的頂端或底端時，往外移 SHALL 無任何反應。專案項的提示文字 SHALL 寫出這組按鍵。

#### Scenario: 往下移一格
- **WHEN** 清單依序為 A、B、C，focus 在 A，使用者按 Alt+↓
- **THEN** 清單變成 B、A、C，focus 仍在 A

#### Scenario: 頂端再往上
- **WHEN** focus 在清單第一個專案，使用者按 Alt+↑
- **THEN** 清單順序不變，不寫回

### Requirement: 不可排序的情況
下列情況 MUST NOT 能以拖曳或鍵盤調整順序：切換、加入或移除專案進行中；清單處於收合狀態（使用者需先全部展開）；該專案項正顯示移除確認。暫時項 SHALL 固定在清單最上面，本身 MUST NOT 被移動，其他專案也 MUST NOT 被移到它上面。在這些情況下按住專案項放開，仍 SHALL 照「切換專案」處理。

#### Scenario: 收合時不能拖
- **WHEN** 清單超過收合門檻而處於收合狀態，使用者按住一個專案拖動
- **THEN** 清單順序不變；展開後才能拖曳

#### Scenario: 暫時項不參與排序
- **WHEN** 清單最上面是暫時項，使用者把第二個專案往上拖或按 Alt+↑
- **THEN** 該專案最多停在暫時項正下方，暫時項仍在最上面

#### Scenario: 移除確認中的專案不能拖
- **WHEN** 某專案項正顯示移除確認，使用者在該列按住拖動
- **THEN** 不進入拖曳，清單順序不變

#### Scenario: 切換進行中不能排序
- **WHEN** 切換專案尚未完成，使用者對某專案按 Alt+↓
- **THEN** 清單順序不變

### Requirement: 順序寫回失敗
調整順序後，畫面 SHALL 立即顯示新順序。寫回沒有成功時（呼叫失敗、設定檔寫不進去、或寫回當下的清單已不是使用者調整時看到的那份），清單 SHALL 回到上一次成功寫回的順序，並以 toast 說明沒有存成功。寫回當下清單已變動時，toast 文字為「The project list has changed. Try again.」；其他失敗為「Could not save the project order.」。送去寫回的順序與目前清單不是同一組專案（缺項、多出不在清單的路徑、或同一路徑重複）時 SHALL 視為清單已變動而拒絕，設定不變。

開發用 API 的排序端點收到的內容不是路徑字串清單時 SHALL 回 400 與訊息「Send the project paths as a list of strings.」；比對失敗與寫檔失敗同樣回 400，回應內容帶 `ok: false` 與上述訊息。

排序寫回途中又開始切換、加入或移除專案時，該動作 SHALL 等寫回完成後才開始；同時有多個這類動作在等時，只有第一個會執行，其餘回報「Another project action is still running.」。

#### Scenario: 設定檔寫不進去
- **WHEN** 設定檔所在位置不可寫，使用者把 C 拖到最上面
- **THEN** 清單回到 A、B、C 並顯示 toast；重啟後也是 A、B、C

#### Scenario: 寫回失敗彈回
- **WHEN** 使用者把 C 拖到最上面，寫回的呼叫失敗
- **THEN** 清單回到 A、B、C，並顯示 toast 說明順序沒有存成功
