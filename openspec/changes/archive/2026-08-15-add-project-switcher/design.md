## Context

動機見 proposal.md。現況與本設計相關的三件事：

- 目標路徑已收斂單點：`server/utils/openspec-cli.ts` 的 `resolveTargetPath()`（env ‖ cwd），所有 route 與 watcher 都從它拿路徑——C5 的本質是把這個單點從「啟動時定死」變成「執行期可換的伺服端狀態」。
- `server/utils/change-watcher.ts` 是 singleton、刻意只掛載一次不重試；C5 需要它能 teardown / re-mount。
- 前端 API 已有 gateway 介面抽象（`src/api/gateway.ts`，web-gateway 為唯一實作），為 Tauri 換原生能力預留的縫就開在這層。

結構層依 `docs/ui-structure-decisions.md`（專案清單全展開、不用下拉；hover ✕ 移除；底部 Add project）。

## Goals / Non-Goals

**Goals:**

- 專案清單的加入／移除／切換全部在側欄完成，含持久化與徽章。
- 切換語意乾淨：一個明確的伺服端動作，watcher、前端 store 的失效都掛在這個動作上。

**Non-Goals:**

- Settings 頁與 CLI 路徑覆寫（沿 `openspec-cli.ts` 既有註記，留待後續 change）。
- 非 current 專案的即時徽章（watcher 只盯 current，弱一致是刻意選擇）。
- 全機掃描自動發現專案（ROADMAP 既定：手動加入）。
- 視覺精修（C7 收尾；本 change 只用既有 tokens）。

## Decisions

決策於 explore ＋ srun:decisions 收斂，此處記錄結論與理由：

1. **「目前專案」為伺服端持有的狀態（A 案）**，切換＝`POST /api/project/switch`，之後既有 API 一律不帶專案參數。捨棄 request 攜帶專案參數的 B 案：單人桌面 App 無多 client 情境，B 的無狀態優點蒸發，還把狀態搬成一池 per-project watcher 更複雜；A 改動面積最小、watcher 永遠只有一個。切換動作同時是 teardown / re-mount watcher 與清 store 的掛載點。
2. **設定檔**：`~/Library/Application Support/specrun-app/`（平台慣例位置，Windows/Linux 依對應慣例）下單一 JSON，`{ projects: string[], lastActivePath: string | null }`。不存顯示名——用目錄名，重複時帶父層路徑消歧，少一個要維護的欄位。損毀視為空清單重建，不 crash。
3. **啟動優先序**：env `SPECRUN_PROJECT_PATH`（dev override）> `lastActivePath` > cwd fallback（僅當 cwd 為 openspec 專案，dogfooding）；三者皆不成立 → 無目標專案、空清單引導。env 與 cwd fallback 得出的專案若不在清單，以**暫時項**顯示、不寫入設定檔——避免 dev 路徑汙染設定，切換功能照常可測。
4. **每專案徽章＝未 archive 的 change 數，弱一致**：啟動時並行刷一輪、切換時再刷；current 隨變動通知即時。捨棄「watch 所有專案」的完全即時（多 watcher 管理複雜度與決策 1 相悖）。取數失敗（路徑失效、CLI 失敗）不顯示數字，不編。
5. **加入專案走 gateway 縫**：介面加 `pickFolder()` 類方法；web-gateway 過渡期實作為貼路徑輸入，Tauri 後換 dialog plugin 原生選資料夾，前端元件不感知差異。
6. **驗證與失效語意**：加入時驗「既存資料夾且含 `openspec/`」；之後失效 lazy——切過去才以既有 `target-missing` probe 呈現，不背景輪詢。realpath 去重：已存在則提示並直接切換。
7. **移除語意**：確認後只移出清單、不動磁碟；移除 current → 切清單第一個；清空 → 空清單引導。
8. **切換後前端狀態**：detail store 清空、回 change 清單畫面；changes store 全量重載。切換由前端發起，重取不依賴 SSE 通知。

**刻意留白（非遺漏，Coder 自行決定）：**

- 清單收合門檻暫定 6（超過折疊「Show all」），數字可依實作手感調整。
- 徽章啟動刷新的並行上限、貼路徑輸入列的展開形式等實作細節。

## 側欄 Projects 區 wireframe（結構層，動工前人工審）

```
 PROJECTS
 ┌──────────────────────────────┐
 │ ● specrun-app            [3] │  ← current：accent 底＋實心點（沿用現行樣式）
 │   my-blog             ✕  [1] │  ← hover：底色浮現、✕ 出現（點擊跳確認）
 │   side-project               │  ← 取不到數字：無徽章
 │   ＋ Add project             │  ← 點擊展開輸入列
 │   ┌────────────────────────┐ │
 │   │ /path/to/repo    [Add] │ │  ← web 過渡期：貼路徑；Esc / blur 收合
 │   └────────────────────────┘ │
 └──────────────────────────────┘
```

點擊非 current 項＝切換；點擊 current 項無動作。清單超過門檻折疊，current 永遠可見。

## Risks / Trade-offs

- [非 current 徽章過期誤導]（終端機 archive 後側欄數字仍舊）→ 弱一致是明示決策；切換過去即刷新，且 current 永遠即時。
- [切換瞬間的競態：舊專案的 in-flight 請求晚到蓋掉新專案資料] → 切換時 store 帶世代標記（或 abort in-flight），晚到回應丟棄。
- [watcher re-mount 失敗（新專案路徑掛不了 watch）] → 沿既有語意：失去通知不影響其他功能，手動刷新仍可用。
- [設定檔並發寫入（理論上單 App 單寫者）] → 寫入走整檔原子替換（temp + rename），不做鎖。
- [`process.cwd()` 在 Tauri 打包後語意消失] → cwd fallback 僅為 dev dogfooding 而存在，打包後自然走 lastActivePath ／空清單引導，無需額外處理。

## Migration Plan

無資料遷移——設定檔首次啟動不存在即視為空清單；既有單專案行為（env / dogfood）由優先序鏈完整涵蓋，dev 工作流不變。回滾＝退版即可，設定檔向前無害。
