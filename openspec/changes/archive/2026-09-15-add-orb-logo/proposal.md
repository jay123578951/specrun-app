## Why

側欄左上角目前只有一個 8×8px 的旋轉方塊。它是佔位用的裝飾，不是記號——放大、縮小、換色都不會改變任何人對這個 App 的認識，專案裡也沒有任何 logo 圖檔。App 已經走到套上桌面外殼的階段，需要一個站得住的品牌記號。

這個記號不只是靜止的圖形：它會很緩慢地呼吸。這個 App 的自我定位是「監視器不只是查看器」，一個安靜活著的記號比一個死掉的方塊更接近那件事。呼吸幅度經實測極小（外緣只動 0.1px、不旋轉），份量介於「看得到它活著」與「不會一直想去瞄它」之間。

## What Changes

- 新增品牌記號：一個 50px 的記號，外圈是由細點組成、緩慢起伏的環，中間是一個終端機提示符號
- 環的動畫取自 thinking-orbs（MIT，Copyright (c) 2026 Jakub Antalik）。套件本身是 React 元件，本專案不安裝它；改為把其中與框架無關的幾何運算搬進專案，另寫 Vue 元件驅動
- 環的顏色改由 accent 色階承擔（套件原本只畫灰階），與既有語意色體系一致
- `AppSidebar.vue` 的旋轉方塊移除，改掛新記號
- 側欄品牌列高度從 68.6px 變 85px，底下的 PROJECTS 清單整批下移 16.4px

不在範圍內：記號不與 watcher 連動（不會因為外部改檔而改變動法）；其他頁面與元件不引入這個記號；`AppSidebar.vue` 的其餘兩段（專案清單、Settings）不動。

## Capabilities

### New Capabilities

- `brand-mark`: 側欄品牌記號的呈現與動態行為——記號長什麼樣、什麼時候動、什麼時候停成定格、以及在使用者要求減少動態時的呈現。

### Modified Capabilities

- `change-list`: 「側欄結構」requirement 的 Logo 段原本未規範內容，現改為明確承載品牌記號，其行為委派 brand-mark capability（與專案清單段委派 project-management、Settings 委派 app-settings 同一寫法）。

## Impact

**程式碼**

- `src/components/AppSidebar.vue`：品牌列的方塊換成記號元件
- 新增品牌記號的 Vue 元件
- 新增搬入的第三方幾何運算檔（純函式、不碰 DOM、不含 React），檔頭保留出處與 MIT 著作權聲明

**相依**

- `package.json` 不變——不安裝 `thinking-orbs`（它要求 React ≥18，本專案是 Vue 3）
- 沿用既有的 `@iconify-json/lucide` 取得終端機提示符號
- 沿用既有語意色 `--sr-surface` 與 `--sr-accent-bright`，不新增色票

**版面**

- 側欄品牌列 68.6px → 85px；PROJECTS 清單與其下所有內容下移 16.4px。側欄寬度不變（該列用掉 147px，內寬 189px）

**無變動**

- 後端 API、openspec CLI 通道、watcher、任何資料路徑
