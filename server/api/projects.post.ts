import type { ProjectActionResult } from '../../src/api/types'
import { remountWatcher } from '../utils/change-watcher'
import { addProject } from '../utils/project-state'
import { buildSnapshot } from '../utils/projects-snapshot'

/**
 * `POST /api/projects`：加入專案。驗證（既存資料夾＋含 `openspec/`）與 canonical
 * 去重都在 project-state；加入成功即成為目前專案，所以 watcher 要跟著換掛。
 */
export default defineEventHandler(async (event): Promise<ProjectActionResult> => {
  const body = await readBody(event) as { path?: unknown } | null
  const input = typeof body?.path === 'string' ? body.path : ''

  const outcome = await addProject(input)
  if (!outcome.ok) {
    setResponseStatus(event, 400)
    return { ok: false, message: outcome.message }
  }

  await remountWatcher()
  return {
    ok: true,
    alreadyExisted: outcome.alreadyExisted,
    snapshot: await buildSnapshot({ badges: false }),
  }
})
