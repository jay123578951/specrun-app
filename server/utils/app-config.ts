import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import process from 'node:process'

/**
 * 專案清單的持久化載體（design D2）：平台慣例位置下的單一 JSON。
 *
 * 兩條紀律：讀壞不 crash——無法解析一律降級成空清單重建；寫入走 temp + rename
 * 的整檔原子替換，不做鎖（單 App 單寫者，見 design 風險欄）。
 */

export interface AppConfig {
  /** canonical 化後的專案路徑，順序即側欄顯示順序 */
  projects: string[]
  /** 最後啟用的專案；啟動優先序的第二順位 */
  lastActivePath: string | null
}

const APP_FOLDER = 'specrun-app'
const FILE_NAME = 'config.json'

export function emptyConfig(): AppConfig {
  return { projects: [], lastActivePath: null }
}

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

export function configFilePath(): string {
  const dir = resolveConfigDir({ platform: process.platform, env: process.env, home: homedir() })
  return path.join(dir, FILE_NAME)
}

/**
 * 逐欄位收斂：認不得的形狀一律丟掉，不讓外部改壞的資料流進執行期狀態。
 * 整份壞掉與部分欄位壞掉是同一種處理——能救幾個算幾個，其餘回預設。
 */
export function parseConfig(raw: string | null): AppConfig {
  if (!raw)
    return emptyConfig()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  }
  catch {
    return emptyConfig()
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    return emptyConfig()

  const record = parsed as Record<string, unknown>
  const projects: string[] = []
  if (Array.isArray(record.projects)) {
    for (const entry of record.projects) {
      if (typeof entry === 'string' && entry && !projects.includes(entry))
        projects.push(entry)
    }
  }

  const last = record.lastActivePath
  return {
    projects,
    lastActivePath: typeof last === 'string' && last ? last : null,
  }
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
    await writeFile(temp, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
    await rename(temp, file)
  }
  catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}
