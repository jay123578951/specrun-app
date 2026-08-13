# Design: scaffold-app-shell

## Context

見 proposal.md - Why。空 repo 起手，技術棧已在 ROADMAP.md 決策表鎖定（Vue 3 + Vite + UnoCSS + Pinia + Nitro），本 change 只處理「怎麼擺」。

## Goals / Non-Goals

**Goals**
- 一個指令（`pnpm dev`）同時起前端與 API，瀏覽器開頁即驗證通路
- 目錄結構為後續 C1~C7 留好擴充位，不需再搬家

**Non-Goals**
- 視覺／design tokens（D1 專門處理，本 change 的畫面允許醜）
- production build 流程的完整性（M4 套 Tauri 時再處理，本階段 dev 形態夠用）
- openspec CLI 串接（C1 起）

## Decisions

### D1. Vite 與 Nitro 的共存方式：兩個 process ＋ Vite proxy

`pnpm dev` 用 concurrently 同時起 Nitro（port 3210）與 Vite（port 5173），Vite 設 `server.proxy` 把 `/api` 轉給 Nitro。

- 為什麼不用 Nuxt（一體化）：ROADMAP 已定 Vite + Nitro 分離——M4 套 Tauri 時前端要能單獨抽出給 webview，後端層要能整組換成 Tauri command，分離結構的搬移成本最低。
- 為什麼不用 Nitro 直接 serve 前端靜態檔：dev 階段會失去 Vite HMR，不值得。

### D2. 目錄佈局

```
specrun-app/
├─ src/            # Vue 前端（views/ components/ stores/ composables/）
├─ server/         # Nitro（api/ 下放 event handlers）
│  └─ api/health.get.ts
├─ vite.config.ts
├─ nitro.config.ts
├─ uno.config.ts   # 只掛 preset，不定義 theme/tokens
└─ eslint.config.js
```

前後端同一套件（單 package.json）：兩邊都是 TypeScript、依賴少，拆 workspace 是過度設計；若日後 Tauri 需要再拆，邊界已由目錄隔開。

### D3. API 呼叫抽象

前端呼叫後端一律經過 `src/api/` 的薄封裝（C0 先只有 `getHealth()`），不在元件內直接 fetch——這是 ROADMAP「後端呼叫抽 interface、M4 換 Tauri command 無痛」決策的落地起點。

## Risks / Trade-offs

- 兩個 process 的 dev 體驗依賴 concurrently 的輸出交錯，可讀性略差——接受，M4 前都是個人 dev 用途。

## Migration Plan

無（空 repo 起手）。

## Open Questions

無——視覺相關全部刻意留白給 D1 change，非遺漏。
