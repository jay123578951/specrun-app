import type { OpenSpecGateway } from './types'
import { applyOverride, cliSettings, redetect } from './desktop/cli'
import { diagnostics } from './desktop/diagnostics'
import { addProject, listProjects, removeProject, switchProject } from './desktop/projects'
import { getChangeDetail, getSpecContent, listChanges, listSpecs } from './desktop/reads'
import { webGateway } from './web-gateway'

/**
 * 桌面形態的 gateway。設定、CLI 解析、環境診斷，以及 change 與 spec 的讀取由這個
 * 行程自己持有，不經本地 API server；其餘方法（勾選、park、archived、原生對話框）
 * 在各自搬完之前仍走本地 API server（過渡期兩個行程並存）。
 */
export const desktopGateway: OpenSpecGateway = {
  ...webGateway,

  listProjects,
  addProject,
  removeProject,
  switchProject,

  listChanges,
  getChangeDetail,
  listSpecs,
  getSpecContent,

  getCliSettings: cliSettings,
  applyCliPath: applyOverride,
  redetectCli: redetect,

  getDiagnostics: diagnostics,
}
