import type { OpenSpecGateway } from './types'
import { getArchivedDetail, listArchived } from './desktop/archived'
import { applyOverride, cliSettings, redetect } from './desktop/cli'
import { diagnostics } from './desktop/diagnostics'
import { pickFolder } from './desktop/folder-picker'
import { parkChange, unparkChange } from './desktop/park'
import { getParkedDetail, listParked } from './desktop/parked'
import { addProject, listProjects, removeProject, switchProject } from './desktop/projects'
import { getChangeDetail, getSpecContent, listChanges, listSpecs } from './desktop/reads'
import { toggleTask } from './desktop/tasks'
import { subscribeToChanges } from './desktop/watch'
import { webGateway } from './web-gateway'

/**
 * 桌面形態的 gateway。設定、CLI 解析、環境診斷、change 與 spec 的讀取、檔案變動通知、
 * 檔案操作面（勾選寫入、park／unpark、parked 與 archived 的清單與詳情），以及加入專案
 * 的原生資料夾選擇，由這個行程自己持有，不經本地 API server；過渡期間仍經本地 API
 * server 的只剩開啟檔案所在位置（兩個行程並存）。
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

  pickFolder,

  getCliSettings: cliSettings,
  applyCliPath: applyOverride,
  redetectCli: redetect,

  getDiagnostics: diagnostics,

  subscribeToChanges,
}
