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

/**
 * App 取得規格資料的唯一通道。web 版走 Nitro route，M4 Tauri 版換成 shell plugin
 * 實作——呼叫端只認這個介面，替換範圍收斂在一個檔案。
 */
export interface OpenSpecGateway {
  listChanges: () => Promise<ChangeListResult>
  getChangeDetail: (name: string) => Promise<ChangeDetailResult>
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
