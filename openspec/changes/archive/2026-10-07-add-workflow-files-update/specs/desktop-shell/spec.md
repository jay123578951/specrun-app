# Spec Delta

## MODIFIED Requirements

### Requirement: 專案路徑的檔案存取授權

外殼 SHALL 提供前端可呼叫的目錄授權通道：授權後該目錄（遞迴）SHALL 可由前端讀寫。授權一個專案路徑時 MUST 同時使其 `.git` 子目錄（遞迴）可存取——遞迴授權不涵蓋 dotfile 目錄，而 park 機制依賴 `.git/specrun-app/` 的讀寫。授權一個專案路徑時 MUST 同時使其 `.claude/skills` 子目錄（遞迴）可存取——流程檔版本讀取依賴其下 skill 檔；`.claude` 底下的其他目錄 MUST NOT 因此可存取。

授權範圍 SHALL 涵蓋查詢檔案與目錄的基本資訊（是否為目錄、建立時刻等），不限於內容的讀寫——清單的建立時刻欄位依賴該查詢。

#### Scenario: 授權後可讀寫專案檔案

- **WHEN** 前端對某專案路徑呼叫授權通道，隨後讀寫該專案內的一般檔案
- **THEN** 讀寫成功

#### Scenario: 授權涵蓋 .git 子目錄

- **WHEN** 前端對某專案路徑呼叫授權通道，隨後在該專案 `.git/specrun-app/` 下建目錄與寫檔
- **THEN** 操作成功，無需前端另行對 `.git` 發起授權

#### Scenario: 授權涵蓋基本資訊查詢

- **WHEN** 前端對某專案路徑呼叫授權通道，隨後查詢該專案某個 change 目錄的建立時刻
- **THEN** 查得該目錄的建立時刻，MUST NOT 因權限而落入讀不到的降級

#### Scenario: 授權涵蓋 .claude/skills 子目錄

- **WHEN** 前端對某專案路徑呼叫授權通道，隨後讀取該專案 `.claude/skills/openspec-explore/SKILL.md`
- **THEN** 讀取成功，無需前端另行對 `.claude/skills` 發起授權

#### Scenario: .claude 其他目錄仍不可存取

- **WHEN** 前端對某專案路徑呼叫授權通道，隨後讀取該專案 `.claude/settings.json`
- **THEN** 讀取被拒絕
