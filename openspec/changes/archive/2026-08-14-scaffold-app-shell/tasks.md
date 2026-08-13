# Tasks: scaffold-app-shell

## 1. 專案初始化

- [x] 1.1 `pnpm init` 建立 package.json（private、type: module），加入 `.gitignore`（node_modules、dist、.nitro、.output）
- [x] 1.2 安裝依賴：vue、pinia；devDeps：vite、@vitejs/plugin-vue、typescript、vue-tsc、unocss、nitropack、concurrently、eslint、@antfu/eslint-config
- [x] 1.3 建立 `tsconfig.json`（Vue 3 + strict）與 `eslint.config.js`（antfu config 預設）

## 2. 後端骨架（Nitro）

- [x] 2.1 建立 `nitro.config.ts`（srcDir: server、port 3210）
- [x] 2.2 建立 `server/api/health.get.ts`：回傳 `{ status: 'ok', timestamp }`

## 3. 前端骨架（Vite + Vue）

- [x] 3.1 建立 `vite.config.ts`：vue plugin、UnoCSS plugin、`server.proxy` 將 `/api` 轉 `http://localhost:3210`
- [x] 3.2 建立 `uno.config.ts`：presetWind4，不定義任何 theme/tokens（D1 change 的留白）
- [x] 3.3 建立 `index.html`、`src/main.ts`（掛 Pinia、UnoCSS）、`src/App.vue`
- [x] 3.4 建立 `src/api/index.ts` 薄封裝（`getHealth()`），`App.vue` 顯示 health 回應（無樣式要求）

## 4. 整合與驗證

- [x] 4.1 package.json scripts：`dev`（concurrently 起 Nitro＋Vite）、`build`、`lint`、`typecheck`
- [x] 4.2 驗證：`pnpm dev` 一個指令起雙 process，瀏覽器開 5173 看到 health 的 `ok`；`pnpm lint` 與 `pnpm typecheck` 乾淨通過
