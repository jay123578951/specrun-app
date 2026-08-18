import type { CliApplyResult } from '../../src/api/types'
import { applyOverride } from '../utils/cli-resolver'

/**
 * `POST /api/cli`：驗證並套用一個明示覆寫路徑（design D6 的單一動作）。
 * `--version` 成功才寫 config 並更換執行期狀態；失敗不寫入、目前生效者不變。
 * 驗證失敗一律 200——與 pick-folder／toggle 同一套姿態，前端依 body 分流。
 */
export default defineEventHandler(async (event): Promise<CliApplyResult> => {
  const body = await readBody<{ path?: unknown }>(event).catch(() => null)
  const input = typeof body?.path === 'string' ? body.path : ''
  return applyOverride(input)
})
