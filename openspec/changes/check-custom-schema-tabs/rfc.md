# Custom schema 驗收樣本

這筆 change 用 `rfc-lite` schema（artifact 為 `rfc` / `plan`，刻意不含 `proposal`），
供 C2 詳情檢視人工驗收使用。`plan` 刻意留空，用來驗缺件 tab 的空狀態。

## 驗收要點

| 驗收點 | 期望 |
| --- | --- |
| tabs 動態列出 | 只出現 `rfc`、`plan`，不出現寫死的 `proposal` |
| 無 proposal 的 fallback | 自別的 change 切過來時，tab 落在清單第一個（`rfc`） |
| 缺件 tab | `plan` 可點，顯示「尚未建立」空狀態、非錯誤樣式 |

## 唯讀 task list

- [x] 已勾項目應呈現勾選狀態
- [ ] 未勾項目應呈現未勾狀態
- [ ] 點擊 checkbox 不應有任何反應（勾選是 C4 範圍）

## Code fence 高亮

```ts
const gateway: OpenSpecGateway = createWebGateway()
const result = await gateway.getChangeDetail('check-custom-schema-tabs')
```

```bash
openspec status --change check-custom-schema-tabs --json
```

## 連結行為

- 外部連結應於新分頁開啟：[OpenSpec](https://github.com/Fission-AI/OpenSpec)
- 相對連結應為非互動弱化樣式、點擊無反應：[plan](./plan.md)
