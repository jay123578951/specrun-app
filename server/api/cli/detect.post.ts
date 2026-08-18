import type { CliSettings } from '../../../src/api/types'
import { redetect } from '../../utils/cli-resolver'

/**
 * `POST /api/cli/detect`：撤掉明示覆寫、清掉快取的解析結果並重跑三段降級。
 * 兩種模式互斥，回到自動偵測就不該有覆寫留著（否則下次啟動又跳回手動模式）。
 */
export default defineEventHandler((): Promise<CliSettings> => redetect())
