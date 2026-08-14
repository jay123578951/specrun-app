import type { ProjectActionResult } from '../../../src/api/types'
import { remountWatcher } from '../../utils/change-watcher'
import { switchProject } from '../../utils/project-state'
import { buildSnapshot } from '../../utils/projects-snapshot'

/**
 * `POST /api/project/switch`：整個切換語意的單一掛載點（design D1）。
 * 更新目前專案與 `lastActivePath`、把 watcher 換掛到新專案，回傳新的清單狀態；
 * 前端的 store 失效也掛在這一趟的回應上。
 */
export default defineEventHandler(async (event): Promise<ProjectActionResult> => {
  const body = await readBody(event) as { path?: unknown } | null
  const input = typeof body?.path === 'string' ? body.path : ''

  const outcome = await switchProject(input)
  if (!outcome.ok) {
    setResponseStatus(event, 400)
    return { ok: false, message: outcome.message }
  }

  await remountWatcher()
  return { ok: true, snapshot: await buildSnapshot({ badges: false }) }
})
