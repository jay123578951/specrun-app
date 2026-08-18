import type { EnvironmentDiagnostics } from '../../src/api/types'
import pkg from '../../package.json'
import { configFilePath } from '../utils/app-config'
import { isWatching } from '../utils/change-watcher'
import { currentProjectPath } from '../utils/project-state'
import { canReveal } from '../utils/reveal'

/**
 * `GET /api/diagnostics`：「App 到底連到什麼」的答案（唯讀）。
 * 三個外部接點（設定檔、目標專案、檔案變動通知）目前在畫面上全部無跡可循。
 * 無目標專案時 `projectPath` 為 null——由 UI 明確標示為無，這裡不編空字串。
 */
export default defineEventHandler(async (): Promise<EnvironmentDiagnostics> => {
  return {
    configPath: configFilePath(),
    projectPath: await currentProjectPath(),
    watching: isWatching(),
    appVersion: pkg.version,
    canReveal: canReveal(),
  }
})
