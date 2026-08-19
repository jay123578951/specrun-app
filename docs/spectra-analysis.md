# Spectra 競品分析結論

2026-08-19 逐項討論定案。素材：Spectra v2.3.1（閉源，GitHub repo 僅發佈用；分析自安裝版 CLI、12 個 skills prompt、`.git/spectra-app/spectra.db` schema、t-cert 真實 spec 資料）。

前提原則（過濾器）：specrun 是薄殼吃 openspec CLI 紅利、被動操作不掛 LLM。Spectra 走反向路線（自建引擎、格式已分岔到 `docs/specs/`）——其功能可參考，其架構是反面教材。

## 計分板

| # | 項目 | 判定 |
|---|---|---|
| ① | 目錄 mtime 陷阱 | 無坑收案 |
| ② | git commondir 統一 metadata | 觀察項（升級既有 worktree 條目） |
| ③ | drift 偵測 | 觀察項（定性改寫，見下） |
| ④ | propose 完自動 park | 功能不做，語意採納 |
| ⑤ | touched files 追蹤／@trace | 整項不做 |
| ⑥ | 詞彙墓碑 | ✅ 已落地（config.yaml context） |
| ⑦ | skills prompt patterns | 本專案零動作；kit 結論待評估（見下） |
| ⑧ | Compact mode | 觀察項（M4 後憑痛感） |
| ⑨ | demo 資料 onboarding | 不做 |

## 各項要點

### ① mtime——無坑，引擎紅利的實證

Spectra 2.3.0 修過「目錄 mtime 當修改時間」的 bug；openspec CLI 的 `getLastModified` 天生正確（遞迴取目錄內所有檔案的最大 mtime）。查證 specrun 三條路徑全乾淨：卡片排序吃 CLI 順序、archive-store 不碰 mtime、parked-store 的 stat 只判存在性。

### ② worktree metadata 落點（觀察項）

Spectra 教訓：metadata 落在 per-worktree gitdir 會讓各 worktree 看到不同清單，2.3.0 才統一到 commondir。specrun 未來支援 worktree park 時：落點必須是 `git rev-parse --git-common-dir`；且 commondir 只解決 metadata，change 檔案本體在各 worktree 有各自 checkout 副本，需要 change↔worktree 的 ownership 語意（Spectra 有 `worktree_artifact_ownership` 表可參考）。

### ③ drift／stale 訊號（觀察項，定性已改寫）

Spectra 的 drift 假設「時間驅動」（停三週沒人理）。但 specrun 的 park 是**排隊語意**——(a) 有先後序不能同時實作、(b) 當前 change 實作中先討論下一項。stale 的來源不是時間，是「排在前面的 change 落地了」：B 的 design 寫在 A 實作之前，落差是排隊語意的必然副產品，與停幾天無關。

- App 層候選訊號：**archived-since-parked 計數**——比對 `parkedAt` 與 archive 目錄日期前綴，純檔案層、零誤報，卡片一行 "N changes landed since parked"。比 Spectra 的四維評分更貼工作流且成本趨近零。
- kit 層候選：unpark 後開工前的 refresh（A 的實際實作對照 B 的 design/tasks），LLM 做語意比對比 Spectra 的關鍵字啟發式準。
- 開 change 時機：第一次真實 unpark 時確實感到「要重看計畫哪裡過期」。
- Spectra 可抄細節：guidance-only 不 hard block；檢查量上限（cap）bound 執行時間。

### ④ auto-park——功能不做，語意採納

Spectra 的 auto-park 成立前提是引擎自己認得 parked 狀態；specrun 的 park 是殼上功能，openspec CLI 看不見 parked change，propose 完自動 park 會打斷「人工審（常伴隨修改與 validate）」。且正確的 park 時點是「審完、等待期開始」，只有人知道。

採納的語意約定：**Active＝動工中或審核中；Parked＝已審完、排隊等開工**。手動一拖發生在唯一正確的時點。真要自動化，等 OpenSpec Stores 模型穩定（既有觀察項）。

### ⑤ touched files／@trace——不做

三個斷點：openspec 無 `task done` 收集點（自建＝走向自有格式）；串行實作讓 commit 歸屬平凡化（dirty source 必屬唯一實作中的 change）；@trace 的前半（requirement↔change）archive delta spec 已有。commit message 帶 change 名的蒸餾版約定也已否決——維持現行乾淨 message。

### ⑥ 詞彙墓碑——已落地

概念採納（spec 對死詞沉默，「窄軌已廢」這類否定性事實在 spec 體系沒有位置）、Spectra 的獨立檔案載體否決（不往 openspec/ 塞私建檔案）。落點：`openspec/config.yaml` 的 `context` 欄位（openspec 官方插槽，instructions 原生帶給每次 artifact 撰寫；查證 init 只在檔案不存在時建立、update 不碰 config——升級零衝突風險）。

已種三條：slideover ← 窄軌/收合變形/ChangeRail；park/unpark ← 暫存；麵包屑頁切換 ← 側欄入口/當前頁高亮。維護時點：推翻名詞的定案當下順手加一行（規則已寫在區塊標題行）。

實證動機：`docs/ui-structure-decisions.md` 仍以「窄軌/收合變形」描述詳情檢視（C7 已推翻）——底稿當歷史文件保留，靠墓碑解毒，不回頭清洗。

### ⑦ kit 相關結論（待再評估，暫不動手）

載體分界定案：**紀律入 kit（user-scope plugin，跟人走）、資料入 config.yaml（跟專案走）**。config.yaml 手抄規則到各專案＝複製漂移，否決。

待評估三條（2026-08-19 討論傾向，尚未裁決是否值得做）：

1. **墓碑觸發規則入 SessionStart hook**（intent-guidance.sh）：一行「定案推翻名詞→config.yaml 墓碑區補一行，無區塊則建立」。放 decisions 模板只覆蓋用了 decisions 的 session（可跳過）；hook 覆蓋每個 session。代價：hook payload 是每 session 的 context 成本，只放觸發行。
2. **Durable Handoff 檢查**（feat 前置或 decisions 收尾）：task 不得只寫檔案路徑（要描述可觀察行為）、不得行號定位（用函數/行為名）、驗收須有 verification target（測試名/指令/斷言）。
3. **Rationalization Table**（feat/fix 模板）：「你正在想什麼→你該做什麼」對照表；條目不抄 Spectra，由 /srun:retro 觀察到的真實開脫模式餵養，一次一兩條慢慢長。

輕量附帶：example 具體數值確認的習慣（收斂到行為時用真實數值例確認，例子直通 scenario 與測資）。否決：假設模式（explore 是上游生成 skill 不可改；decisions 進場時紅利窗口已過）；fork 紀律已有（opus-reviewer 已 report-only＋白名單）。

### ⑧ Compact mode（觀察項）

浮動小面板監看任務進度。證據：使用者的 Spectra preferences 留有 compact 視窗座標（用過）。前提是 Tauri 第二視窗（always-on-top），M4 之前做不了；資訊面已存在（C3 live refresh），缺的只是形態。M4 後 dogfood「終端實作中瞄進度」，頻繁切視窗的痛感真實再開 change。

### ⑨ demo 資料——不做

Spectra 受眾是陌生下載者；specrun 受眾是自己且 dogfood 資料第一天就有。demo 假 change 要嘛污染真 repo 要嘛破壞「畫面即磁碟真相」原則。翻案條件：App 有了作者以外的使用者（屆時形態應是內建唯讀範例專案，不是塞假 change）。
