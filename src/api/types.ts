export interface HealthResponse {
  status: string
  timestamp: number
}

/** CLI `status` 的三值；進度語意由引擎（schema-aware）決定，App 不自行推導 */
export type ChangeStatus = 'no-tasks' | 'in-progress' | 'complete'

/** 卡片所需的 change 摘要，欄位一對一取自 `openspec list --json` */
export interface ChangeSummary {
  name: string
  completedTasks: number
  totalTasks: number
  status: ChangeStatus
  /** 最後修改時間（epoch ms；CLI 給 ISO 字串，normalize 轉換） */
  lastModified: number
}

/** 三類錯誤，對應 spec openspec-gateway「錯誤分類」與 UI 的三層呈現 */
export type GatewayErrorKind = 'cli-unavailable' | 'not-openspec-project' | 'call-failed'

export interface GatewayError {
  kind: GatewayErrorKind
  /** 面向使用者的英文說明，UI 直接顯示 */
  message: string
  /** 診斷細節（CLI 的 fix 提示、stderr 摘要、實際解析到的 root）；UI 可選擇顯示 */
  detail?: string
}

export type ChangeListResult
  = { ok: true, targetPath: string, changes: ChangeSummary[] }
    | { ok: false, targetPath: string, error: GatewayError }

/** artifact 的一個既存檔案；specs 這類 glob artifact 可有多個 */
export interface ArtifactFile {
  /** 相對 changeRoot 的顯示路徑，specs 多檔串接時當標頭 */
  path: string
  content: string
}

/** 內容面板的一個 tab；順序沿用 CLI，名稱不寫死（custom schema 必須可用） */
export interface ArtifactView {
  id: string
  files: ArtifactFile[]
  /** 尚無既存檔案——是缺件不是錯誤（spec openspec-gateway） */
  missing: boolean
}

export interface ChangeDetail {
  name: string
  artifacts: ArtifactView[]
}

export type ChangeDetailResult
  = { ok: true, detail: ChangeDetail }
    | { ok: false, error: GatewayError }

/** 勾選寫入的請求：不帶路徑，只帶行號與該行原文（design D1） */
export interface TaskToggleInput {
  /** 0-based 來源行號 */
  line: number
  /** 呼叫端所見的該行原文，不含行尾符；伺服端據此比對併發 */
  expectedText: string
  /** 目標勾選狀態 */
  checked: boolean
}

/**
 * 勾選寫入的三分結果（design D1）：成功／目標行已被外部改寫／其他失敗。
 * 衝突自成一類——UI 的提示文案必須與一般失敗可區分（spec artifact-view）。
 */
export type ToggleResult
  = { ok: true }
    | { ok: false, kind: 'conflict' }
    | { ok: false, kind: 'failed', message: string, detail?: string }

/** 側欄專案清單的一項 */
export interface ProjectEntry {
  /** canonical 化後的絕對路徑，同時是各操作的識別鍵 */
  path: string
  /** 顯示名＝目錄名，與別項同名時帶父層消歧（design D2：不另存顯示名） */
  name: string
  current: boolean
  /** 由 env／cwd 決定但不在持久化清單中——顯示為暫時項（spec 覆寫與 fallback 為暫時項） */
  temporary: boolean
  /** 未 archive 的 change 數；取不到就是 null，UI 不顯示徽章、不編數字 */
  badge: number | null
}

export interface ProjectsSnapshot {
  projects: ProjectEntry[]
  /** null＝無目標專案（空清單引導） */
  currentPath: string | null
  /**
   * 本次回應是否帶徽章數。切換／加入／移除刻意不等徽章（每項一趟 CLI，~1s）——
   * false 時呼叫端沿用既有數字，另行刷新（spec 徽章弱一致）。
   */
  badgesIncluded: boolean
}

export type ProjectActionResult
  = { ok: true, snapshot: ProjectsSnapshot, alreadyExisted?: boolean }
    | { ok: false, message: string, detail?: string }

/**
 * App 取得規格資料的唯一通道。web 版走 Nitro route，M4 Tauri 版換成 shell plugin
 * 實作——呼叫端只認這個介面，替換範圍收斂在一個檔案。
 */
export interface OpenSpecGateway {
  listChanges: () => Promise<ChangeListResult>
  getChangeDetail: (name: string) => Promise<ChangeDetailResult>
  /**
   * 翻轉某 change tasks 檔案中單一 task 行的勾選狀態——App 的唯一寫入通道。
   * 寫入是檔案層操作、不經 CLI 改寫內容；進度數字仍由引擎於後續讀取時重算。
   * 目標檔案由實作端自 `artifactPaths` 解析，呼叫端無從指定路徑（spec openspec-gateway）。
   */
  toggleTask: (name: string, input: TaskToggleInput) => Promise<ToggleResult>
  /**
   * 訂閱目標專案 `openspec/changes/` 的變動通知；回傳取消訂閱。
   * 通知粗粒度、不帶 payload，收到就自行重取。斷線由實作靜默重連，不對外拋錯。
   * web 版走 SSE route，M4 Tauri 版換成 fs plugin 的 watch 事件——呼叫端只認 callback。
   */
  subscribeToChanges: (onChange: () => void) => () => void

  /** 專案清單（含目前專案標示與徽章數）；徽章取不到的項回 null */
  listProjects: () => Promise<ProjectActionResult>
  /** 加入並立即切換；已在清單中則回 `alreadyExisted` 並照樣切過去 */
  addProject: (path: string) => Promise<ProjectActionResult>
  /** 只移出清單，不動磁碟 */
  removeProject: (path: string) => Promise<ProjectActionResult>
  switchProject: (path: string) => Promise<ProjectActionResult>

  /**
   * 原生選資料夾的縫（design D5）：M4 Tauri 版走 dialog plugin，回傳使用者選的路徑。
   * web 版沒有這個能力（`canPickFolder` 為 false），呼叫端改走貼路徑輸入列。
   */
  canPickFolder: boolean
  pickFolder: () => Promise<string | null>
}

/**
 * `GET /api/changes` 的回傳：一次 CLI 呼叫的原始結果。
 * route 只負責 spawn 與原樣轉送，解析與錯誤分類全在 shared normalize（design D1）。
 */
export interface ChangeListProbe {
  /** canonical 化（realpath）後的目標專案路徑 */
  targetPath: string
  /** CLI process 的 exit code；spawn 未成立時為 null */
  exitCode: number | null
  stdout: string
  stderr: string
  /** spawn 層失敗：CLI 執行檔不存在、目標路徑不存在、逾時 */
  failure?: ProbeFailure
}

export interface ProbeFailure {
  kind: 'cli-unavailable' | 'target-missing' | 'spawn-failed'
  message: string
}

/**
 * `GET /api/changes/:name` 的回傳：一次 `status --change` 呼叫的原始輸出，
 * 加上依 `artifactPaths` 讀齊的檔案內容（design D1 的一趟打包）。
 * 同樣只轉送不解析——分類與組裝在 shared normalize。
 */
export interface ChangeDetailProbe extends ChangeListProbe {
  changeName: string
  /**
   * artifact id → 該 artifact 各既存檔案的讀取結果，順序沿用 `existingOutputPaths`。
   * 只在 CLI 呼叫成功時出現；讀檔範圍即 CLI 列出的路徑（design D3 白名單）。
   */
  files?: Record<string, ArtifactFileProbe[]>
}

export interface ArtifactFileProbe {
  /** CLI 給的絕對路徑，原樣帶回 */
  path: string
  content?: string
  /** 讀檔失敗的系統訊息；有值時 content 必為 undefined */
  error?: string
}
