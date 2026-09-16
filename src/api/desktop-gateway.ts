import type { OpenSpecGateway } from './types'
import { applyOverride, cliSettings, redetect } from './desktop/cli'
import { diagnostics } from './desktop/diagnostics'
import { addProject, listProjects, removeProject, switchProject } from './desktop/projects'
import { webGateway } from './web-gateway'

/**
 * 桌面形態的 gateway。設定、CLI 解析與環境診斷由這個行程自己持有，不經本地 API server；
 * 其餘方法在讀取面搬完之前仍走本地 API server（過渡期兩個行程並存）。
 */
export const desktopGateway: OpenSpecGateway = {
  ...webGateway,

  listProjects,
  addProject,
  removeProject,
  switchProject,

  getCliSettings: cliSettings,
  applyCliPath: applyOverride,
  redetectCli: redetect,

  getDiagnostics: diagnostics,
}
