import type { RevealOutcome } from '../../src/api/types'
import { revealPath } from '../utils/reveal'

/**
 * `POST /api/reveal`：在檔案管理器中開啟某路徑的所在位置。
 * 平台不支援與失敗都以 status 表達（比照 pick-folder），一律 200——
 * 前端依 status 分流，不看狀態碼。
 */
export default defineEventHandler(async (event): Promise<RevealOutcome> => {
  const body = await readBody<{ path?: unknown }>(event).catch(() => null)
  const target = typeof body?.path === 'string' ? body.path : ''
  return revealPath(target)
})
