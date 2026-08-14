import type { ChangeListProbe, ChangeListResult, OpenSpecGateway } from './types'
import { normalizeChangeList } from './normalize'

/** web（Vite dev／Nitro 部署）版 gateway：向本地 route 取 CLI 原始輸出，再交給 shared normalize */
export const webGateway: OpenSpecGateway = {
  async listChanges(): Promise<ChangeListResult> {
    let probe: ChangeListProbe
    try {
      const res = await fetch('/api/changes')
      if (!res.ok)
        throw new Error(`GET /api/changes failed: ${res.status}`)
      probe = await res.json() as ChangeListProbe
    }
    catch (error) {
      // 連本地 route 都到不了（server 沒起、網路層失敗）——歸「呼叫失敗」，不是 CLI 缺失
      return {
        ok: false,
        targetPath: '',
        error: {
          kind: 'call-failed',
          message: 'Could not read the change list.',
          detail: error instanceof Error ? error.message : String(error),
        },
      }
    }
    return normalizeChangeList(probe)
  },
}
