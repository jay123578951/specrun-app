import type { ProjectActionResult } from '../../src/api/types'
import { buildSnapshot } from '../utils/projects-snapshot'

/**
 * `GET /api/projects`：側欄清單的唯一來源。這是唯一會去算徽章的端點
 * ——啟動時一輪、切換後補一輪，其餘操作沿用既有數字（spec 徽章弱一致）。
 */
export default defineEventHandler(async (): Promise<ProjectActionResult> => {
  return { ok: true, snapshot: await buildSnapshot({ badges: true }) }
})
