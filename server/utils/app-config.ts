import type { AppConfig } from '../../src/api/app-config'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import {
  APP_FOLDER,
  emptyConfig,
  expandHome as expandHomeWith,
  CONFIG_FILE_NAME as FILE_NAME,
  parseConfig,
  serializeConfig,
} from '../../src/api/app-config'

/**
 * 專案清單的持久化載體（design D2）：平台慣例位置下的單一 JSON。
 *
 * 欄位、內容解析與寫出格式住在 `src/api/app-config.ts`——桌面形態讀寫的是同一份
 * 檔案，格式只能有一個決定處。這裡留的是 node 這一側的檔案通道與平台位置解析。
 *
 * 兩條紀律：讀壞不 crash——無法解析一律降級成空清單重建；寫入走 temp + rename
 * 的整檔原子替換，不做鎖（單 App 單寫者，見 design 風險欄）。
 */

export type { AppConfig }
export { emptyConfig, parseConfig }

export interface ConfigDirInputs {
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  home: string
}

/** macOS／Windows／其餘（XDG）各走各自慣例；三個輸入都可注入，平台分支才測得動 */
export function resolveConfigDir({ platform, env, home }: ConfigDirInputs): string {
  if (platform === 'darwin')
    return path.join(home, 'Library', 'Application Support', APP_FOLDER)
  if (platform === 'win32')
    return path.join(env.APPDATA?.trim() || path.join(home, 'AppData', 'Roaming'), APP_FOLDER)
  return path.join(env.XDG_CONFIG_HOME?.trim() || path.join(home, '.config'), APP_FOLDER)
}

/** 貼進來的路徑常帶 `~`，展開一下比丟「找不到」有用（專案路徑與 CLI 路徑共用） */
export function expandHome(target: string): string {
  return expandHomeWith(target, homedir())
}

export function configFilePath(): string {
  const dir = resolveConfigDir({ platform: process.platform, env: process.env, home: homedir() })
  return path.join(dir, FILE_NAME)
}

/** 檔案不存在、讀不到、內容壞掉——三者對呼叫端是同一件事：目前沒有可用的清單 */
export async function readConfig(file: string = configFilePath()): Promise<AppConfig> {
  try {
    return parseConfig(await readFile(file, 'utf8'))
  }
  catch {
    return emptyConfig()
  }
}

export async function writeConfig(config: AppConfig, file: string = configFilePath()): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })

  // 同目錄的 temp 才保證 rename 是同一檔案系統內的原子操作
  const temp = `${file}.${process.pid}.tmp`
  try {
    await writeFile(temp, serializeConfig(config), 'utf8')
    await rename(temp, file)
  }
  catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}
