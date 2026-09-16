import type { AppConfig } from '../app-config'
import { APP_FOLDER, CONFIG_FILE_NAME, emptyConfig, parseConfig, serializeConfig } from '../app-config'
import { configRoot, joinPath, makeDir, readTextFile, removePath, renamePath, writeTextFile } from './shell'

/**
 * 桌面形態下設定檔的唯一持有處。專案清單與 CLI 覆寫住在同一份檔案、寫入又是
 * 整檔覆寫，所以整個 App 只能有一份執行期狀態——專案與 CLI 兩邊都改這一份，
 * 誰都不再自己讀一次檔案再寫回去（那會把對方剛寫的欄位蓋掉）。
 */

// 兩個路徑在一個 process 內不會變，算一次就夠。快取的是「算出來的路徑」而不是那一趟
// 計算本身——快取住失敗的計算等於設定檔從此讀不到也寫不進去，直到 App 重開。
let cachedDir: string | null = null
let cachedFile: string | null = null
let configPromise: Promise<AppConfig> | null = null

async function configDirPath(): Promise<string> {
  cachedDir ??= await joinPath(await configRoot(), APP_FOLDER)
  return cachedDir
}

export async function configFilePath(): Promise<string> {
  cachedFile ??= await joinPath(await configDirPath(), CONFIG_FILE_NAME)
  return cachedFile
}

export function config(): Promise<AppConfig> {
  configPromise ??= load()
  return configPromise
}

export async function persist(): Promise<void> {
  try {
    await write(await config())
  }
  catch {
    // 設定寫不進去（唯讀家目錄、配額滿）不影響當下操作
  }
}

async function load(): Promise<AppConfig> {
  try {
    return parseConfig(await readTextFile(await configFilePath()))
  }
  catch {
    return emptyConfig()
  }
}

async function write(current: AppConfig): Promise<void> {
  const file = await configFilePath()
  await makeDir(await configDirPath())

  // 同一個資料夾內的暫存檔才保證 rename 是同一檔案系統內的原子操作。
  // 後綴每次現算：兩次寫入重疊時才不會撞到同一個暫存路徑，讓後到的 rename 撲空
  const temp = `${file}.${Math.random().toString(36).slice(2, 10)}.tmp`
  try {
    await writeTextFile(temp, serializeConfig(current))
    await renamePath(temp, file)
  }
  catch (error) {
    await removePath(temp).catch(() => {})
    throw error
  }
}
