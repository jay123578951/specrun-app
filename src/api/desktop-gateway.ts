import type { OpenSpecGateway } from './types'
import { getArchivedDetail, listArchived } from './desktop/archived'
import { applyOverride, cliSettings, redetect } from './desktop/cli'
import { diagnostics } from './desktop/diagnostics'
import { parkChange, unparkChange } from './desktop/park'
import { getParkedDetail, listParked } from './desktop/parked'
import { addProject, listProjects, removeProject, switchProject } from './desktop/projects'
import { getChangeDetail, getSpecContent, listChanges, listSpecs } from './desktop/reads'
import { toggleTask } from './desktop/tasks'
import { webGateway } from './web-gateway'

/**
 * 桌面形態的 gateway。設定、CLI 解析、環境診斷、change 與 spec 的讀取，以及檔案操作面
 * （勾選寫入、park／unpark、parked 與 archived 的清單與詳情）由這個行程自己持有，
 * 不經本地 API server；其餘方法（檔案變動通知、原生對話框、開啟檔案所在位置）
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

  toggleTask,

  listParked,
  parkChange,
  unparkChange,
  getParkedDetail,

  listArchived,
  getArchivedDetail,

  getCliSettings: cliSettings,
  applyCliPath: applyOverride,
  redetectCli: redetect,

  getDiagnostics: diagnostics,
}
