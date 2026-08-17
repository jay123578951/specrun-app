import type { PickFolderOutcome } from '../../src/api/types'
import { pickFolder } from '../utils/folder-picker'

/**
 * `POST /api/pick-folder`：開作業系統原生資料夾選擇 dialog，回傳所選路徑。
 * 平台不支援、使用者取消、已有 dialog 開著都以 status 表達（design D1），
 * 一律 200——前端依 status 分流，不看狀態碼。
 */
export default defineEventHandler((): Promise<PickFolderOutcome> => pickFolder())
