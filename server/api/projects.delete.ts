import type { ProjectActionResult } from '../../src/api/types'
import { remountWatcher } from '../utils/change-watcher'
import { currentProjectPath, removeProject } from '../utils/project-state'
import { buildSnapshot } from '../utils/projects-snapshot'

/**
 * `DELETE /api/projects?path=…`：只把專案移出清單，磁碟上的任何檔案都不動。
 * 移除的若是目前專案，project-state 會接手清單第一個——那才需要重掛 watcher。
 *
 * 路徑走 query 而非 body：DELETE 帶 body 在代理層的支援參差，沒必要冒這個險。
 */
export default defineEventHandler(async (event): Promise<ProjectActionResult> => {
  const input = getQuery(event).path
  if (typeof input !== 'string' || !input.trim()) {
    setResponseStatus(event, 400)
    return { ok: false, message: 'No project was given to remove.' }
  }

  const before = await currentProjectPath()
  await removeProject(input)
  if (await currentProjectPath() !== before)
    await remountWatcher()

  return { ok: true, snapshot: await buildSnapshot({ badges: false }) }
})
