import type { OpenSpecGateway } from './types'
import { getArchivedDetail, listArchived } from './desktop/archived'
import { applyOverride, cliSettings, redetect } from './desktop/cli'
import { diagnostics } from './desktop/diagnostics'
import { pickFolder } from './desktop/folder-picker'
import { openUrl, revealPath } from './desktop/opener'
import { parkChange, unparkChange } from './desktop/park'
import { getParkedDetail, listParked } from './desktop/parked'
import { addProject, listProjects, removeProject, switchProject } from './desktop/projects'
import { getChangeDetail, getSpecContent, listChanges, listSpecs } from './desktop/reads'
import { toggleTask } from './desktop/tasks'
import { subscribeToChanges } from './desktop/watch'

/**
 * 桌面形態的 gateway。設定、CLI 解析、環境診斷、change 與 spec 的讀取、檔案變動通知、
 * 檔案操作面（勾選寫入、park／unpark、parked 與 archived 的清單與詳情）、加入專案的
 * 原生資料夾選擇，以及開啟檔案所在位置與開啟外部網址，全數由這個行程自己持有，不經
 * 本地 API server——至此不再展開 web 形態的實作，介面上的每一個方法都指到桌面自己的
 * 模組。桌面開發通路仍併跑本地 API server，但那一份只服務在瀏覽器中執行的那一份，
 * 桌面形態本身不依賴它是否在跑。
 */
export const desktopGateway: OpenSpecGateway = {
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

  revealPath,
  openUrl,
}
