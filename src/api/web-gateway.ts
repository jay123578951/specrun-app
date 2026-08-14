import type {
  ChangeDetailProbe,
  ChangeDetailResult,
  ChangeListProbe,
  ChangeListResult,
  OpenSpecGateway,
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
