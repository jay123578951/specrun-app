import type { OpenSpecGateway } from './types'
import { webGateway } from './web-gateway'

/**
 * App 唯一的規格資料入口。M4 套 Tauri 殼時把這裡換成 tauriGateway
 * （shell plugin spawn → 同一份 normalize），呼叫端零改動。
 */
export const gateway: OpenSpecGateway = webGateway
