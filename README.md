# specrun-app

OpenSpec 相容的桌面 spec 管理 App（規劃見 `ROADMAP.md`）。引擎完全外包 [openspec CLI](https://github.com/Fission-AI/OpenSpec)，本專案只做 UI 與平台外殼。

## 開發

```sh
pnpm install
pnpm dev        # web 形態：nitro (3210) + vite (5173) 併跑
pnpm dev:app    # 桌面形態：Tauri 視窗，內部自動帶起 pnpm dev
```

- `pnpm dev` 純前端工作流，不需 Rust。
- `pnpm dev:app` 需要 Rust 工具鏈：`rustup` 安裝 stable 即可（https://rustup.rs）。

## 檢查

```sh
pnpm lint
pnpm typecheck
pnpm test
```
