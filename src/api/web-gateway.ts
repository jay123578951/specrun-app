import type {
  ChangeDetailProbe,
  ChangeDetailResult,
  ChangeListProbe,
  ChangeListResult,
  OpenSpecGateway,
  TaskToggleInput,
  ToggleResult,
} from './types'
import { normalizeChangeDetail, normalizeChangeList } from './normalize'

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
    source.onmessage = () => onChange()
    source.onerror = () => {
      // EventSource 自帶重連：斷線期間不通知、恢復後照常，全程不對外拋錯（spec 韌性）
    }
    return () => source.close()
  },
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
