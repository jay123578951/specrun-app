import type { EnvironmentDiagnostics } from '../types'
import { version } from '../../../package.json'
import { configFilePath } from './config-store'
import { currentProjectPath } from './projects'
import { isWatching } from './watch'

/**
 * 桌面形態的環境診斷。檔案變動通知一項改讀 watch.ts 的「現在有沒有接上」，
 * 兩態，不回未知。「開啟所在位置」的通道還沒搬到這個形態，那一項仍回未知（null）。
 */
export async function diagnostics(): Promise<EnvironmentDiagnostics> {
  return {
    configPath: await configFilePath(),
    projectPath: await currentProjectPath(),
    watching: isWatching(),
    appVersion: version,
    canReveal: null,
  }
}
