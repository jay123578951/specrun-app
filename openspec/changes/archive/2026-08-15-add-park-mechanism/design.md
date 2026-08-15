## Context

動機見 proposal.md；決策收斂過程見 ROADMAP.md M2 段落（2026-08-15 explore＋decisions 定案）。

既有架構約束：

- 資料通道走 gateway interface（`src/api/gateway.ts`）＋ Nitro route ＋純函式 normalize（M4 Tauri 換 gateway 實作、餵同一份純函式）。
- watcher 只看 `openspec/changes/`，粗粒度通知（change-watcher.ts）；park/unpark 的搬移會自然觸發 active 清單重載。
- 清單畫面單一狀態源為 `src/stores/changes.ts`；詳情為 `src/stores/detail.ts`（快取＋新鮮度策略）。
- 詳情 tabs 依 `openspec status --json` 的 `artifactPaths` 動態列出——parked change 對 openspec 不可見，此路徑不可用。
- UI 結構層已定於 `docs/ui-structure-decisions.md`：Active/Parked 同頁分群、卡片 hover 動作、群組搬移動畫為招牌時刻。

## Goals / Non-Goals

**Goals:**

- park/unpark 操作＋parked 清單＋parked 唯讀詳情一次交付，可立即 dogfood。
- 存放與 metadata 設計對 openspec 與 git 均無感，且與既有 gateway 架構同構（M4 可換殼）。

**Non-Goals:**

- Spectra 轉接器（無既存資料，ROADMAP 已定不做）。
- git worktree 支援（禁用＋提示；解析 `gitdir:` 記 ROADMAP 觀察項）。
- Settings 頁的存放位置顯示（Settings 整頁仍是靜態殼）。
- 卡片 hover 的複製名稱／刪除動作（M3）。
- park 確認對話框與 undo（操作可逆，不需要）。
- watcher 擴範圍監看 `.git/specrun-app/`（park/unpark 均為本 App 操作，操作後主動刷新即可）。
- 群組搬移動畫的精修（基本 enter/leave 動畫本 change 做、數值依 ui-motion skill；整體打磨屬 C7）。

## Decisions

### D1：存放於 `<repo>/.git/specrun-app/parked/<name>/`

`.git/` 內部天然不被 git 追蹤：無污染免驗證、parked 隨 repo 搬移改名、repo 刪除自動清掉、免 repo-identity 映射。替代案（原 roadmap 草案）：`~/Library/Application Support/` 外部目錄＋索引——需解 repo-identity 映射（repo 搬家斷鏈）、留孤兒資料，已否決。借鑑 Spectra 實測發現的做法，但格式自訂不相容（見 proposal）。

### D2：metadata 為每 repo 一個 `parked.json`，只記搬移會破壞的資訊

`.git/specrun-app/parked.json`，以 change 名為 key：

```json
{
  "add-old-idea": {
    "parkedAt": "2026-08-15T10:00:00Z",
    "artifacts": { "proposal": ["proposal.md"], "specs": ["specs/foo/spec.md"], "tasks": ["tasks.md"] }
  }
}
```

- `parkedAt`：清單顯示「parked 3w ago」與 Parked 群組排序依據。
- `artifacts`：park 當下 `openspec status --json` 的 artifactPaths 快照（change 目錄內相對路徑）——parked 詳情的 tabs 唯一來源；parked 是冷凍狀態，快照不過期。替代案「現場檔案列舉」推不出 custom schema 的 tab 集合與順序，否決。
- 不記任務數／摘要（現場解析，見 D4）；原始 lastModified 不保留——unpark 後 mtime 更新、change 跳到清單頂端，是合理 UX（剛動過它）。

### D3：park 執行順序＝快照 → 搬移 → 寫 metadata

1. `openspec status --change <name> --json` 取 artifactPaths 快照（搬移後就查不到了）；快照失敗 → park 失敗 toast，不搬移（一致性優先，操作可重試）。
2. `fs.rename` 整目錄搬移（.git 與 openspec 同 repo 同卷，原子）；失敗 → toast，不寫 metadata。
3. 寫入 `parked.json`；此步失敗由「目錄為準」原則兜底（清單照列、parkedAt fallback 顯示未知、詳情 tabs fallback 至現場列舉 `*.md`）。

unpark 反向：檢查 `openspec/changes/<name>` 不存在 → rename 搬回 → 自 `parked.json` 移除該 key（移除失敗＝孤兒 metadata，列舉時以目錄為準自然忽略，下次 park 同名時覆寫）。

### D4：parked 清單資料現場解析，不做快取

GET parked 清單時列舉 `.git/specrun-app/parked/`，逐目錄解析 tasks.md 勾選計數與 proposal 首句摘錄（沿用既有 normalize 慣例：Nitro route 只做 IO，解析歸 `src/api/` 純函式，M4 可重用）。parked 數量級小（單專案 0–5），不值得快取層。

### D5：API 與 gateway 介面

- `GET /api/parked` → `{ parkAvailable: boolean, reason?: 'not-git-repo' | 'git-worktree', items: ParkedSummary[] }`——`.git` 目錄檢測結果隨清單一併回傳，前端據此禁用 park 按鈕。
- `POST /api/changes/[name]/park`、`POST /api/parked/[name]/unpark`——撞名／殘留檢查在 server 端，回結構化錯誤供 toast。
- `GET /api/parked/[name]` → parked 詳情打包（仿既有 change 詳情 bundle；讀檔範圍限定快照路徑，對齊 gateway「讀檔範圍限定」的精神）。
- gateway interface 增四個方法，與既有 listChanges/getChangeDetail 同構。

### D6：前端狀態歸屬

parked 清單併入 `src/stores/changes.ts`（清單畫面單一狀態源的既有原則；同頁、同刷新節奏、同 invalidate 時機）。park/unpark 成功後主動 reload active＋parked 兩群組；watcher 通知維持只刷 active。parked 詳情併入 `src/stores/detail.ts` 的資料路徑分流（parked 走快照 bundle，不打 openspec status）。

### 刻意留白（Coder 自行決定，非遺漏）

- park 撞名殘留與各失敗情境的提示措辭（toast 文案）。
- rename 失敗的錯誤分類細節（不做跨卷 copy fallback）。
- tasks.md 勾選計數與首句摘錄的解析實作方式。

## Risks / Trade-offs

- [快照後、搬移前 change 被外部刪除] → rename 失敗走 toast 路徑，metadata 未寫入，無半完成狀態。
- [`fs.rename` 搬移中外部程序正寫入 change 檔案] → rename 目錄為原子操作，開啟中的檔案 handle 跟隨 inode，不毀損；極端競態下 rename 失敗即報錯，可重試。
- [使用者手動動 `.git/specrun-app/`] → 目錄為準原則使清單自癒；孤兒 metadata 被忽略。
- [`.git` 誤判（submodule、bare repo 等罕見形態）] → 檢測規則從嚴（`.git` 必須是目錄），非常規形態一律禁用＋提示，寧可少功能不可誤搬。
- [parked 詳情與 active 詳情共用元件的唯讀分支滲漏（checkbox 禁用漏判）] → spec 有獨立 scenario 把守；寫入 route 僅存在於 active tasks 路徑，server 端天然拒絕。
