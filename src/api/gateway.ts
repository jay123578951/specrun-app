import type { OpenSpecGateway } from './types'
import { isTauri } from '../utils/is-tauri'
import { desktopGateway } from './desktop-gateway'
import { webGateway } from './web-gateway'

/**
 * App 唯一的規格資料入口，依執行形態分流：兩個形態各自持有完整實作，
 * 桌面形態不經本地 API server。呼叫端只認 `OpenSpecGateway`，分流範圍收斂在這一行。
 */
export const gateway: OpenSpecGateway = isTauri() ? desktopGateway : webGateway
