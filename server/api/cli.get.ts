import type { CliSettings } from '../../src/api/types'
import { cliSettings } from '../utils/cli-resolver'

/**
 * `GET /api/cli`：目前的 CLI 模式與解析結果（模式、執行檔、版本或失敗訊息）。
 * 首次取用時才真的跑解析，之後回快取的執行期狀態（見 cli-resolver）。
 */
export default defineEventHandler((): Promise<CliSettings> => cliSettings())
