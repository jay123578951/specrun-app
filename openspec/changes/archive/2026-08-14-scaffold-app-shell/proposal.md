# Proposal: scaffold-app-shell

## Why

specrun-app（OpenSpec 相容的桌面 spec 管理 App）目前只有 roadmap 與規格目錄，沒有可執行的程式骨架。後續所有功能 change（change 列表、artifact 渲染、watcher 等）都需要一個跑得起來的專案環境作為地基。

## What Changes

- 建立 pnpm 專案與 monorepo 免談的單套件結構（單一 app，不拆 workspace）
- 前端：Vite + Vue 3 + TypeScript + Pinia，`<script setup>` Composition API
- 樣式工具：安裝 UnoCSS（僅裝 preset 與管線，**不定義任何 design tokens／主題**——視覺基礎由後續 D1 change 專門處理）
- 本地後端：Nitro server，提供第一支 `GET /api/health` 端點驗證前後端通路
- 前端首頁一頁極簡 hello 畫面，顯示 health 回應，證明 Vite dev ↔ Nitro API 串通
- ESLint（@antfu/eslint-config）與基本 scripts（dev / build / lint）
- `.gitignore` 與專案基本檔案

**不包含**：任何視覺設計決策（tokens、配色、字階、明暗主題）、任何業務功能、openspec CLI 串接。

## Capabilities

### New Capabilities

（無——本 change 為純環境工程，不引入規格層行為，`.openspec.yaml` 已宣告 `skip_specs: true`）

### Modified Capabilities

（無）

## Impact

- 新增：整個前端／後端專案骨架（`package.json`、`vite.config.ts`、`nitro.config.ts`、`src/`、`server/`）
- 依賴：vue、vite、pinia、unocss、nitropack、eslint 及 @antfu/eslint-config
- 不影響既有檔案（ROADMAP.md、openspec/ 不動）
