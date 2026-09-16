import type { OpenSpecGateway } from './types'
import { isTauri } from '../utils/is-tauri'
import { desktopGateway } from './desktop-gateway'
import { webGateway } from './web-gateway'

/**
 * App 唯一的規格資料入口，依執行形態分流：桌面形態的設定與 CLI 解析由該形態
 * 自己持有（其餘方法仍走本地 API server），web 形態全數走本地 API server。
 * 呼叫端只認 `OpenSpecGateway`，分流範圍收斂在這一行。
 */
export const gateway: OpenSpecGateway = isTauri() ? desktopGateway : webGateway
