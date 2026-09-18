import type { EnvironmentDiagnostics } from '../types'
import { version } from '../../../package.json'
import { configFilePath } from './config-store'
import { currentProjectPath } from './projects'
import { isWatching } from './watch'

/**
 * 桌面形態的環境診斷。檔案變動通知一項改讀 watch.ts 的「現在有沒有接上」，
 * 兩態，不回未知。「開啟所在位置」一律回 true：桌面形態的 opener plugin 三個
 * 平台都有實作，沒有 web 形態那種「這個指令只有 macOS 有」的限制，不做平台
 * 分支（design D7）；開不起來的情形落在請求該動作時的失敗，不是這裡的能力值。
 */
export async function diagnostics(): Promise<EnvironmentDiagnostics> {
  return {
    configPath: await configFilePath(),
    projectPath: await currentProjectPath(),
    watching: isWatching(),
    appVersion: version,
    canReveal: true,
  }
}
