import type { OpenSpecGateway } from './types'
import { webGateway } from './web-gateway'

/**
 * App 唯一的規格資料入口。T2 起依 `isTauri()`（src/utils/is-tauri.ts）
 * 分流到 tauriGateway（薄 Rust spawn → 同一份 normalize），呼叫端零改動；
 * T1 尚未分流，恆為 webGateway。
 */
export const gateway: OpenSpecGateway = webGateway
