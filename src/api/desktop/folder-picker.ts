import type { PickFolderOutcome } from '../types'
import { pickFolder as pickFolderShell } from './shell'

/**
 * 桌面形態的原生資料夾選擇。薄殼的三種結果映射成既有的 `PickFolderOutcome`：
 * 有路徑為 `picked`、空值為 `canceled`、失敗為 `failed`。
 *
 * 不回 `unsupported`（桌面形態一律具備能力）與 `busy`（dialog 以主視窗附屬
 * 視窗開啟，開啟期間觸發入口本身點不到，重複開啟不存在觸發條件——見
 * design D2、D3），也不自行維護「已有 dialog 開著」的狀態：每次呼叫都直接
 * 呼叫外殼，不被任何內部旗標擋下。
 */
export async function pickFolder(): Promise<PickFolderOutcome> {
  const result = await pickFolderShell()
  if (!result.ok)
    return { status: 'failed' }
  return result.path === null ? { status: 'canceled' } : { status: 'picked', path: result.path }
}
