## Context

動機見 `proposal.md` 的 Why。這裡只記動工時會撞到的現況與限制。

**打包這條路已經通了。** `tauri build` 在 2026-09-18 跑過，產物躺在 `src-tauri/target/release/bundle/`：`specrun-app.app`（26 MB）與 `specrun-app_0.1.0_aarch64.dmg`（17 MB）。所以本張沒有「能不能打包」的技術風險，只有「打包出來的東西對外是誰」以及「別人裝得起來嗎」。

**名字現在有三處各寫各的。**

```
  specrun-app   tauri.conf.json 的 productName、視窗 title、bundle 名、repo 名、設定資料夾名
  specrun       側欄 wordmark、index.html 的 <title>、三處錯誤訊息內文
  app           Cargo.toml 的 [package] name -> .app 內的執行檔名、行程清單裡的名字
```

**版本也是三處各寫各的。**

```
  package.json      0.0.0   <- 設定頁的「App version」讀這一份
  tauri.conf.json   0.1.0   <- bundle 的 CFBundleShortVersionString 與 dmg 檔名讀這一份
  Cargo.toml        0.1.0   <- tauri.conf.json 有值時不被讀
```

**簽章現況是連結器順手蓋的。** `codesign -dv` 回報 `adhoc, linker-signed`、`Sealed Resources=none`、`Info.plist=not bound`。這種簽章過不了 Gatekeeper 對已下載檔案的檢查，使用者第一次點開會看到「已損毀，應將其丟到垃圾桶」——不是「無法驗證開發者」，那是另一種較溫和的提示。

**唯一沒被證明的東西。** `src/api/cli-resolve.ts` 的自動偵測有三段降級：① 直接以命令名執行、吃行程自己的搜尋路徑；② 借使用者的登入 shell 取絕對路徑；③ 都沒中就回報不可用。第 ② 段整段是為了「從檔案管理器啟動的 App 拿不到終端環境」而寫的，但 `pnpm dev:app` 是從終端起的，第 ① 段就命中，② 從來沒有真的執行過。

## Goals / Non-Goals

**Goals：**

- 打包產物對外的身分（名稱、版本、識別字串）成為一個有單一真值、彼此不打架的組合
- 一個沒有這個專案任何背景的人，照 README 能把 App 裝起來並跑起來
- 把 `cli-resolve.ts` 第 ② 段降級從「寫好但沒驗過」變成「驗過」

**Non-Goals：**

- 不做雙晶片、不簽章、不公證、不做自動更新、不出 Windows
- 不改寫 git 歷史
- 不動任何前端程式碼與 UI 文案
- 不下線本地 API server——web 形態與桌面開發通路照舊併跑（roadmap 於 T4b 已明確不做整批下線）

## Decisions

### 名稱統一到小寫 `specrun`，而不是大寫 Specrun

畫面上早就寫著小寫：側欄 wordmark、`index.html` 的 `<title>`、三處錯誤訊息內文。`brand-mark` 規格的驗收場景甚至把 `wordmark "specrun"` 寫死了。

改成大寫要動側欄一行、`index.html` 一行、三個元件的文案，外加一份 `brand-mark` 的 delta；改成小寫則是把 `tauri.conf.json` 對齊到畫面既有的寫法，前端零改動、零額外 delta。

代價是 `specrun.app` 這個檔名在應用程式資料夾裡跟周圍大寫開頭的 App 並排時略顯不同。接受——開發者工具用小寫字標是常態。

**替代方案：** 大寫 Specrun（動四處文案加一份 delta）、或 Dock 大寫而畫面留小寫（使用者在兩個地方看到兩種寫法，最差）。

### 執行檔改名走 Cargo 套件名，不用 `mainBinaryName`

`.app` 內的執行檔目前叫 `app`，因為 `Cargo.toml` 的 `[package] name = "app"` 沒改過。它會出現在活動監視器的行程清單裡。

Tauri 的設定 schema 提供 `mainBinaryName` 可以覆寫產出的檔名，但它自己的說明就寫著「可以的話請改 package name」——`mainBinaryName` 是在 `tauri build` 階段把 cargo 產出的檔案改名，等於留著一個對不上的來源再補一層改名。

改 `[package] name = "specrun"` 是根治。`[lib] name = "app_lib"` 是另一個欄位、不受影響，但為了不留下半新半舊的命名，一併改為 `specrun_lib`，`src-tauri/src/main.rs` 裡那一行呼叫跟著改。這是整張唯一會動到的 Rust 程式碼，共兩行。

**替代方案：** 用 `mainBinaryName` 覆寫（多留一層改名，來源仍叫 app）、或維持不改（行程清單裡一個叫 `app` 的東西在吃 CPU，使用者無從得知是誰）。

### 版本以 `package.json` 為唯一真值

Tauri 設定的 `version` 欄位接受「semver 字串」或「一個 `package.json` 的路徑」兩種形式。改成 `"version": "../package.json"` 之後，bundle 的版本直接取自 `package.json`，而設定頁的「App version」本來就從 `package.json` 讀（`src/api/desktop/diagnostics.ts` 第 2 行 `import { version } from '../../../package.json'`）。兩邊自然對齊，不需要任何同步機制或檢查。

`package.json` 的 `version` 由 `0.0.0` 拉到 `0.1.0`。`Cargo.toml` 的 `version` 在 Tauri 設定有值時不被讀，但留著兩份對不上的數字遲早誤導人，一併對齊為 `0.1.0`。

**替代方案：** 反過來以 `tauri.conf.json` 為真值、要前端去讀它（webview 讀不到專案檔案，得另外開通道，成本高出一個數量級）；或維持兩份、加一個檢查腳本（多一個會壞的東西去看守一件本來可以不存在的問題）。

### 0.1.0 而非 1.0.0

1.0.0 對外的意思是介面穩定、可以依賴。這一版還沒有任何人用過，`openspec` CLI 的演進也還可能推翻既有假設。0.1.0 留著往上走的空間。

### 只出 Apple 晶片版

雙晶片版本要多裝一個編譯目標、建置時間翻倍、下載檔從 17 MB 變成約 33 MB，而目前手上沒有 Intel Mac 可以驗證產出的那一半真的跑得動——發出一個沒驗過的東西比不發更糟。

代價是 Intel Mac 的使用者下載後點兩下沒有反應。緩解方式是把它寫在使用者一定看得到的兩個位置（README 的安裝段落、Release 說明的第一行），而不是只靠檔名裡的 `aarch64`。

### 系統攔阻的說明要先講現象再給指令

macOS 對未簽章且帶下載標記的 App 顯示的是「已損毀，應將其丟到垃圾桶」。這句話會讓人以為檔案在下載過程中壞了而重新下載一次，再看到同一句話之後放棄。

README 的寫法因此是：先說「你會看到這句話，它不是真的損毀」，再給兩條繞法——

```
  繞法一  終端執行：xattr -d com.apple.quarantine /Applications/specrun.app
  繞法二  系統設定 -> 隱私權與安全性 -> 找到被擋下的項目 -> 強制打開
```

macOS 15 起已經沒有「右鍵點按再選開啟」這條路，不要寫進去。

### 打包指令只跑 vite，不順帶跑 nitro

現在的 `beforeBuildCommand` 是 `pnpm build`，展開是 `vite build && nitro build`。打包產物的 `frontendDist` 指向 `../dist`，`nitro build` 產出的 `.output/` 完全沒被用到，只是讓每次打包多等一段。改成只跑 `vite build`——具體寫法是在 `package.json` 新增 `"build:web": "vite build"`（與既有的 `dev:web` 對稱），`beforeBuildCommand` 寫 `pnpm build:web`。不寫裸的 `vite build`：`vite` 只存在於 `node_modules/.bin`，裸字串要靠呼叫端的搜尋路徑剛好含有它，換一種方式叫 Tauri CLI 就會在打包中途找不到指令。

`pnpm build` 這個 script 本身保留——web 形態的部署仍然需要它。

### 借登入 shell 解析路徑時，把它的搜尋路徑一併帶回來

第 ② 段已經在跑一趟登入 shell 了，那趟的成本（實測 1.1 秒）本來就要付。在同一趟裡多問一次它的搜尋路徑，之後每一次執行 openspec——驗證、`--version`、列清單、讀詳情——都帶著那份路徑，轉接殼就找得到 node。

自動偵測與手動指定共用同一條執行路徑，所以一次修好兩種模式。

手動指定模式拿不到這份搜尋路徑——第 ② 段只在自動偵測時跑，使用者自己貼路徑時整段不會被呼叫。但使用者貼的那個路徑同樣可能是轉接殼，所以那條路也需要搜尋路徑。作法是另外借一次登入 shell，只問搜尋路徑、不順便找 openspec 的位置：同一份能力、不同問法。代價是使用者按下套用時多等約 1.1 秒，而且只有這一次——結果跟著解析結果一起留著，之後每次呼叫 openspec 直接沿用，不再重問。

**替代方案：** 每次呼叫 openspec 都透過登入 shell 跑（每次多付 1.1 秒起 shell 的錢，參數要自己組字串進 shell，輸出還混著使用者 rc 檔的雜訊）；或偵測到轉接殼時自己去找 node（要猜各家版本管理工具的安裝佈局，一種沒猜到就壞）。

### 不改寫 git 歷史（使用者已裁決）

`ROADMAP.md` 與 `docs/` 三份文件以 `git rm --cached` 取消追蹤並加進 `.gitignore`，本機檔案留著。**已知的後果並已接受：** 這三份檔案的完整內容仍在 git 歷史裡，任何人 clone 之後 `git log -p` 讀得到。乾淨的只是 repo 現在的樣子。

因此 repo 轉公開這個動作是不可逆的——一旦推出去就可能已經有人 clone。這一點寫進 tasks 的順序裡：所有整理動作做完、人工看過一遍，轉公開才執行。

### 封存 change 裡的 48 處引用不修

`openspec/changes/archive/` 底下有 48 份文件引用 `ROADMAP.md` 或 `docs/`。它們是封存的歷史紀錄，記錄的是當時的狀態，指向一份後來搬走的文件是合理的。真正要改的是兩處活的引用：`README.md` 第一行、`openspec/config.yaml` 的 `context`。

## Risks / Trade-offs

**從檔案管理器啟動時，找得到 openspec 不等於跑得動**（2026-09-18 實測確認，已推翻本段原本的假設）→ 第 ② 段借登入 shell 解析路徑這一段是成立的，實測拿得到 `~/Library/pnpm/openspec`。斷的是下一步：拿到路徑後回頭用 App 自己的環境去執行它。macOS 給所有從檔案管理器啟動的 App 的搜尋路徑固定是 `/usr/bin:/bin:/usr/sbin:/sbin`，而 `npm install -g` 裝出來的 openspec 是一層 `exec node …` 的轉接殼——node 不管裝在哪（nvm、Homebrew、pnpm、官方安裝檔）都不在那四個目錄裡，所以執行必定以 `exec: node: not found` 收場。這不是單一機器的特例，是所有使用者的情況。

**手動指定路徑同樣不通** → 手動模式走的是同一個 `verify()`，一樣直接執行那個轉接殼、一樣沒有 node。本段原先寫的「退路是手動指定、不擋發佈」不成立：兩條路都斷，使用者拿到的是一個完全不能用的 App。因此本張必須先修這件事才能發佈，不另開 change——被違反的規格就寫在本張自己的 delta 裡，就這樣歸檔等於把一句不成立的話寫進主規格。

**改 Cargo 套件名導致既有建置快取失效** → 下一次 `tauri build` 會整包重編。只是時間，不影響正確性。

**repo 轉公開不可逆** → 排在所有整理動作之後，且人工看過一遍再執行。

**Intel Mac 使用者下載後沒有反應** → 寫在 README 安裝段落與 Release 說明的開頭，不只靠檔名裡的 `aarch64`。

**改設定資料夾名會清空使用者既有設定** → 本張明確不動 `APP_FOLDER`、不動 capabilities 的 `$CONFIG/specrun-app` 靜態範圍、不動 `dev.specrun.app`。顯示名稱改為 `specrun` 與這三者無關，三者都不跟著改。

## Migration Plan

沒有資料遷移。使用者既有的設定檔位置、專案清單與 park 資料全部不動——本張不碰識別字串與設定資料夾名，正是為了讓已經在用的人升級後看到的東西完全一樣。

回退方式：`git revert` 掉檔案層的改動即可，沒有需要反向遷移的狀態。已經發出去的 Release 若要撤，`gh release delete` 加上把 repo 轉回私有；但已被 clone 或下載的部分收不回來，這是不可逆的那一半。
