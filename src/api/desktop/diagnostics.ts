import type { EnvironmentDiagnostics } from '../types'
import { version } from '../../../package.json'
import { configFilePath } from './config-store'
import { currentProjectPath } from './projects'

/**
 * 桌面形態的環境診斷。檔案變動通知與「開啟所在位置」兩項的通道還沒搬到這個形態，
 * 一律回未知而不是 false：過渡期間監看其實由本地 API server 在跑，回 false 等於
 * 斷言「沒在跑」。畫面以「—」呈現，與明確的是／否分得開。
 */
export async function diagnostics(): Promise<EnvironmentDiagnostics> {
  return {
    configPath: await configFilePath(),
    projectPath: await currentProjectPath(),
    watching: null,
    appVersion: version,
    canReveal: null,
  }
}
