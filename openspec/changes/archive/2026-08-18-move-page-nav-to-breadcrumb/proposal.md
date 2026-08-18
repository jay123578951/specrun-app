## Why

側欄把 Specs 與 Archived 放在 PROJECTS 段之外、與真·全域的 Settings 以同權重分隔線切開，讀起來像跨專案共用的全域入口；但兩者在資料層都是目前專案的產物（清單呼叫吃 server 端的目前專案，換專案會強制回 Changes 頁）。UI 說的層級與資料的層級不一致，且此刻正是全 App 唯一從未寫出「現在看的是哪個專案」的地方。

## What Changes

- 側欄移除 Specs 與 Archived 兩個入口，回歸三段結構（Logo／專案清單／Settings）——側欄自此只管專案與全域設定
- 主區頁首新增麵包屑 `<專案名> / [當前頁 ▾]`，承擔兩件事：寫出當前專案身分、承擔三頁之間的切換
- 頁切換下拉三項齊列（Changes／Specs／Archived），標示當前項，預設 Changes
- 麵包屑併入三頁現有的 header 行（取代原本的左側頁標位置），Refresh 控制項留在該行右側，主區總高度不變
- Changes 頁原本兼作頁標的 `Active (n)` 回歸群組標題語意（與 `Parked (n)` 對稱）；Specs／Archived 的數量改掛麵包屑
- **BREAKING**（使用者可見行為）：無目標專案時麵包屑整條不顯示，因此無專案狀態下不再有任何進入 Specs／Archived 頁的路徑。這是刻意的——該狀態下兩頁只有相同的空狀態，且加入專案後既有行為已強制落在 Changes 頁

## Capabilities

### New Capabilities
- `page-navigation`: 主區頁首的麵包屑——專案身分呈現、三頁切換下拉的內容與互動、與 slideover 及無專案狀態的關係

### Modified Capabilities
- `change-list`: 「側欄結構與入口」由四段改為三段；移除 Specs／Archived 入口項及其當前頁高亮規則，連帶移除「Changes 不另設 nav 項、由專案清單標記兼任位置指示」這條——nav 段整段不再存在

## Impact

- `src/components/AppSidebar.vue`：移除 nav 段，四段結構註解與相關 spec 引用同步更新
- 新增麵包屑元件（含頁切換下拉），由 `ChangeList.vue`／`SpecsView.vue`／`ArchivedView.vue` 三頁的 header 共用
- `src/App.vue`：新增「下拉開啟時鍵盤讓位」，與既有 Settings 讓位同構
- `src/stores/view.ts`：不改動（三個 view 值與切頁語意原樣沿用）
- `uno.config.ts`／`src/styles/interactions.css`：下拉沿用既有 overlay 動效配方，不新增曲線或時值
- `docs/ui-structure-decisions.md`：側欄四段結構描述、以及「已否決項」表中「專案下拉選單」一條的裁決範圍需同步
