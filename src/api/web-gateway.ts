import type {
  ArchivedDetailProbe,
  ArchivedListProbe,
  ArchivedListResult,
  ChangeDetailProbe,
  ChangeDetailResult,
  ChangeListProbe,
  ChangeListResult,
  OpenSpecGateway,
  ParkActionResult,
  ParkedDetailProbe,
  ParkedListProbe,
  ParkedListResult,
  PickFolderOutcome,
  ProjectActionResult,
  SpecContentProbe,
  SpecContentResult,
  SpecListProbe,
  SpecListResult,
  TaskToggleInput,
  ToggleResult,
} from './types'
import { normalizeChangeDetail, normalizeChangeList, normalizeSpecContent, normalizeSpecList } from './normalize'
import { normalizeArchivedDetail, normalizeArchivedList } from './normalize-archived'
import { normalizeParkedDetail, normalizeParkedList } from './normalize-parked'

/** web（Vite dev／Nitro 部署）版 gateway：向本地 route 取 CLI 原始輸出，再交給 shared normalize */
export const webGateway: OpenSpecGateway = {
  async listChanges(): Promise<ChangeListResult> {
    let probe: ChangeListProbe
    try {
      probe = await fetchProbe<ChangeListProbe>('/api/changes')
    }
    catch (error) {
      // 連本地 route 都到不了（server 沒起、網路層失敗）——歸「呼叫失敗」，不是 CLI 缺失
      return {
        ok: false,
        targetPath: '',
        error: {
          kind: 'call-failed',
          message: 'Could not read the change list.',
          detail: describe(error),
        },
      }
    }
    return normalizeChangeList(probe)
  },

  async getChangeDetail(name: string): Promise<ChangeDetailResult> {
    let probe: ChangeDetailProbe
    try {
      probe = await fetchProbe<ChangeDetailProbe>(`/api/changes/${encodeURIComponent(name)}`)
    }
    catch (error) {
      return {
        ok: false,
        error: {
          kind: 'call-failed',
          message: 'Could not load this change.',
          detail: describe(error),
        },
      }
    }
    return normalizeChangeDetail(probe)
  },

  async toggleTask(name: string, input: TaskToggleInput): Promise<ToggleResult> {
    try {
      const res = await fetch(`/api/changes/${encodeURIComponent(name)}/tasks/toggle`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })

      // route 的三分結果原樣轉送（409／500 的 body 同樣是 ToggleResult）；
      // 狀態碼只給網路層看，分類一律以 body 為準
      const result = await res.json() as ToggleResult
      if (typeof result?.ok !== 'boolean')
        throw new TypeError(`Unexpected response: ${res.status}`)
      return result
    }
    catch (error) {
      return {
        ok: false,
        kind: 'failed',
        message: 'Could not save this task.',
        detail: describe(error),
      }
    }
  },

  subscribeToChanges(onChange: () => void): () => void {
    const source = new EventSource('/api/watch')
    // 斷線後才需要補償；首次建連（掛載載入已涵蓋）不算，靠這個旗標分辨兩者
    let reconnecting = false
    source.onmessage = () => onChange()
    source.onerror = () => {
      // EventSource 自帶重連：斷線期間不通知、全程不對外拋錯（spec 韌性）
      reconnecting = true
    }
    source.onopen = () => {
      // 斷線期間的變動可能已遺失且不會重播，重連成功視同收到一次通知，補一次重載補齊（spec 韌性）
      if (reconnecting) {
        reconnecting = false
        onChange()
      }
    }
    return () => source.close()
  },

  listProjects(): Promise<ProjectActionResult> {
    return projectRequest('/api/projects', {}, 'Could not read the project list.')
  },

  addProject(path: string): Promise<ProjectActionResult> {
    return projectRequest(
      '/api/projects',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path }) },
      'Could not add this project.',
    )
  },

  removeProject(path: string): Promise<ProjectActionResult> {
    return projectRequest(
      `/api/projects?path=${encodeURIComponent(path)}`,
      { method: 'DELETE' },
      'Could not remove this project.',
    )
  },

  switchProject(path: string): Promise<ProjectActionResult> {
    return projectRequest(
      '/api/project/switch',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path }) },
      'Could not switch to this project.',
    )
  },

  async listSpecs(): Promise<SpecListResult> {
    let probe: SpecListProbe
    try {
      probe = await fetchProbe<SpecListProbe>('/api/specs')
    }
    catch (error) {
      return {
        ok: false,
        targetPath: '',
        error: {
          kind: 'call-failed',
          message: 'Could not read the spec list.',
          detail: describe(error),
        },
      }
    }
    return normalizeSpecList(probe)
  },

  async getSpecContent(id: string): Promise<SpecContentResult> {
    let probe: SpecContentProbe
    try {
      probe = await fetchProbe<SpecContentProbe>(`/api/specs/${encodeURIComponent(id)}`)
    }
    catch (error) {
      return {
        ok: false,
        error: {
          kind: 'call-failed',
          message: 'Could not load this spec.',
          detail: describe(error),
        },
      }
    }
    return normalizeSpecContent(probe)
  },

  async listParked(): Promise<ParkedListResult> {
    let probe: ParkedListProbe
    try {
      probe = await fetchProbe<ParkedListProbe>('/api/parked')
    }
    catch (error) {
      return {
        ok: false,
        error: {
          kind: 'call-failed',
          message: 'Could not read the parked list.',
          detail: describe(error),
        },
      }
    }
    return normalizeParkedList(probe)
  },

  parkChange(name: string): Promise<ParkActionResult> {
    return parkRequest(`/api/changes/${encodeURIComponent(name)}/park`, 'Could not park this change.')
  },

  unparkChange(name: string): Promise<ParkActionResult> {
    return parkRequest(`/api/parked/${encodeURIComponent(name)}/unpark`, 'Could not restore this change.')
  },

  async getParkedDetail(name: string): Promise<ChangeDetailResult> {
    let probe: ParkedDetailProbe
    try {
      probe = await fetchProbe<ParkedDetailProbe>(`/api/parked/${encodeURIComponent(name)}`)
    }
    catch (error) {
      return {
        ok: false,
        error: {
          kind: 'call-failed',
          message: 'Could not load this parked change.',
          detail: describe(error),
        },
      }
    }
    return normalizeParkedDetail(probe)
  },

  async listArchived(): Promise<ArchivedListResult> {
    let probe: ArchivedListProbe
    try {
      probe = await fetchProbe<ArchivedListProbe>('/api/archived')
    }
    catch (error) {
      return {
        ok: false,
        targetPath: '',
        error: {
          kind: 'call-failed',
          message: 'Could not read the archived list.',
          detail: describe(error),
        },
      }
    }
    return normalizeArchivedList(probe)
  },

  async getArchivedDetail(dir: string): Promise<ChangeDetailResult> {
    let probe: ArchivedDetailProbe
    try {
      probe = await fetchProbe<ArchivedDetailProbe>(`/api/archived/${encodeURIComponent(dir)}`)
    }
    catch (error) {
      return {
        ok: false,
        error: {
          kind: 'call-failed',
          message: 'Could not load this archived change.',
          detail: describe(error),
        },
      }
    }
    return normalizeArchivedDetail(probe)
  },

  /**
   * dialog 由本機 server 開（macOS 走 osascript）：平台不支援、取消、失敗都由 body 的
   * status 表達，這裡只在連 route 都到不了時自己造 failed——結果同樣是一則 toast。
   */
  async pickFolder(): Promise<PickFolderOutcome> {
    try {
      const res = await fetch('/api/pick-folder', { method: 'POST' })
      const result = await res.json() as PickFolderOutcome
      if (typeof result?.status !== 'string')
        throw new TypeError(`Unexpected response: ${res.status}`)
      return result
    }
    catch {
      return { status: 'failed' }
    }
  },
}

/**
 * 四個 project 端點的共同形狀：成功與驗證失敗都以 body 為準（400 的 body 同樣是
 * ProjectActionResult，與 toggle route 同一套姿態），只有連 route 都到不了才自己造錯誤。
 */
async function projectRequest(
  url: string,
  init: RequestInit,
  failureMessage: string,
): Promise<ProjectActionResult> {
  try {
    const res = await fetch(url, init)
    const result = await res.json() as ProjectActionResult
    if (typeof result?.ok !== 'boolean')
      throw new TypeError(`Unexpected response: ${res.status}`)
    return result
  }
  catch (error) {
    return { ok: false, message: failureMessage, detail: describe(error) }
  }
}

/**
 * park／unpark 的共同形狀：與 project 端點同一套姿態——分類一律以 body 為準
 * （400 的 body 同樣是 ParkActionResult），只有連 route 都到不了才自己造訊息。
 */
async function parkRequest(url: string, failureMessage: string): Promise<ParkActionResult> {
  try {
    const res = await fetch(url, { method: 'POST' })
    const result = await res.json() as ParkActionResult
    if (typeof result?.ok !== 'boolean')
      throw new TypeError(`Unexpected response: ${res.status}`)
    return result
  }
  catch (error) {
    return { ok: false, message: failureMessage, detail: describe(error) }
  }
}

async function fetchProbe<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`GET ${url} failed: ${res.status}`)
  return await res.json() as T
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
