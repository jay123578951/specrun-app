## Why

Dock、Finder 與 Cmd-Tab 上顯示的仍是 Tauri 內建的預設圖示，與這個 App 毫無關係。品牌記號已在側欄就位，把它做成 App 圖示是補齊 App 識別的最小一步，且與 gateway 移植（T2～T4）零相依，可先落地——那三張做完畫面完全不變，這張是打包前唯一看得見的進展。

## What Changes

- `src-tauri/icons/` 全套預設圖示由品牌記號產出的圖示取代
- 新增一支產生器：在 Node 跑與側欄同一份幾何運算，輸出一張 1024×1024 的圖示來源圖；全平台尺寸交由 `tauri icon` 產出
- 圖示為單一來源圖機械縮放到所有尺寸，不為小尺寸另做簡化版
- `brand-mark` 主 spec 擴充：品牌記號自此有兩種呈現形態（側欄的動態記號、App 圖示的靜態形態），需規範兩者的異同

**非目標**（留在 T5 `add-app-release`）：App 名稱、bundle identifier、版本定版、`tauri build` 產出 .app、README 安裝說明與首發 Release。本 change 只換圖示檔與其產生方式。

## Capabilities

### New Capabilities

無。App 圖示是既有品牌記號的另一種呈現，不是新的能力。

### Modified Capabilities

- `brand-mark`: 目前的 Purpose 只涵蓋側欄那個會動的記號。新增 App 圖示形態的需求——它與側欄記號共用同一份幾何與色階，但自帶底、恆定靜止、亮度另行對應；並明訂哪些側欄規則對圖示不適用。

## Impact

- `src-tauri/icons/`：全部 16 個檔案由產生器輸出覆蓋
- 新增產生器腳本一支（位置與形式見 design.md）
- `src/utils/orb-engine.ts`、`src/utils/orb-color.ts`：唯讀取用，一行不改
- `src/components/BrandMark.vue`：不動，側欄的記號行為完全不變
- `src-tauri/tauri.conf.json`：`bundle.icon` 清單不變（`tauri icon` 產出的檔名與現有清單一致）
- `package.json`：新增一個產生圖示的 script
