import { Channel, invoke } from '@tauri-apps/api/core'
import { configDir, homeDir, join, normalize } from '@tauri-apps/api/path'
import { expandHome } from '../app-config'

/**
 * 桌面外殼的通道薄層：檔案、路徑、外部指令三類，一律只做型別與錯誤形狀的收束，
 * 不放任何商業規則。
 *
 * 檔案通道走 Tauri 官方的 fs plugin（Rust 端已註冊），這裡直接 invoke 它的指令
 * 而不另外裝 JS binding 套件——`@tauri-apps/api` 的 invoke 已足夠，指令名與參數
 * 形狀由 plugin 版本決定（見 Cargo.toml 的 tauri-plugin-fs）。「開啟外部網址」
 * 比照同一做法，走 Tauri 官方的 opener plugin，直接 invoke 指令、不裝它的 JS
 * binding 套件（見 design D8，即 `add-tauri-gateway-opener` 的 design）。
 * 「開啟檔案所在位置」則不直接 invoke 該外掛的 JS 指令——改呼叫自寫的
 * `open_in_file_manager`，它在 Rust 端包該外掛的 Rust API（見
 * `open-project-folder-directly` 的 design D1、D2）。
 */

export interface SpawnLimits {
  timeoutMs: number
  maxOutputBytes: number
}

export interface SpawnResult {
  status: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  truncated: boolean
}

/**
 * 程式路徑不存在或不可執行時外殼回錯誤（invoke reject），逾時與輸出爆量則是
 * 成功路徑加旗標——兩者對呼叫端是不同的事，所以收成一個聯集而不是丟例外。
 */
export type SpawnOutcome
  = { ok: true, result: SpawnResult }
    | { ok: false, message: string }

/**
 * `env` 只用來疊加少數幾個變數（目前僅 `PATH`）在子行程既有環境之上，不是取代
 * 整份環境——呼叫端決定要帶哪些變數，這裡只管轉傳（cli.ts 的搜尋路徑即一例）。
 */
export async function spawnBin(
  program: string,
  args: string[],
  cwd: string,
  limits: SpawnLimits,
  env?: Record<string, string>,
): Promise<SpawnOutcome> {
  try {
    const result = await invoke<SpawnResult>('spawn_bin', {
      program,
      args,
      cwd,
      timeoutMs: limits.timeoutMs,
      maxOutputBytes: limits.maxOutputBytes,
      env: env ?? null,
    })
    return { ok: true, result }
  }
  catch (error) {
    return { ok: false, message: describe(error) }
  }
}

export function allowPath(path: string): Promise<void> {
  return invoke('allow_path', { path })
}

/**
 * 只放行這一個路徑本身，不遞迴到底下。驗證一個路徑是不是專案得先讀得到它，但
 * tauri 的 fs scope 只能加不能減（Scope::forbid_directory 永久優先於 allow），
 * 驗不過的路徑撤不回來——所以驗證階段給的是這個最小放行，通過了才 allowPath。
 *
 * 外殼回 `false`＝這不是一個資料夾，一次都沒放行（放行一個檔案路徑等於放行它的
 * 內容，打錯字不該換來這個）；reject 才是授權本身失敗。
 */
export function allowDirListing(path: string): Promise<boolean> {
  return invoke<boolean>('allow_dir_listing', { path })
}

/** fs plugin 的 read_text_file 回傳位元組（ArrayBuffer 或 number 陣列），解碼由呼叫端做 */
export async function readTextFile(path: string): Promise<string> {
  const bytes = await invoke<ArrayBuffer | number[]>('plugin:fs|read_text_file', { path })
  return new TextDecoder().decode(bytes instanceof ArrayBuffer ? bytes : Uint8Array.from(bytes))
}

/** fs plugin 的 write_text_file 走 raw request：內容是 body，路徑放在 header 且需 percent-encode */
export function writeTextFile(path: string, contents: string): Promise<void> {
  return invoke('plugin:fs|write_text_file', new TextEncoder().encode(contents), {
    headers: { path: encodeURIComponent(path) },
  })
}

export function makeDir(path: string): Promise<void> {
  return invoke('plugin:fs|mkdir', { path, options: { recursive: true } })
}

export function renamePath(oldPath: string, newPath: string): Promise<void> {
  return invoke('plugin:fs|rename', { oldPath, newPath })
}

export function removePath(path: string): Promise<void> {
  return invoke('plugin:fs|remove', { path })
}

/**
 * fs plugin 的 `exists` 走 Rust `Path::exists`：跟隨 symlink，路徑存在但讀不到時
 * 回 `false` 而不是 reject；被權限清單擋下才 reject。
 */
export function pathExists(path: string): Promise<boolean> {
  return invoke<boolean>('plugin:fs|exists', { path })
}

export interface DirEntry {
  name: string
  isDirectory: boolean
  isFile: boolean
  isSymlink: boolean
}

export function readDir(path: string): Promise<DirEntry[]> {
  return invoke<DirEntry[]>('plugin:fs|read_dir', { path })
}

/**
 * fs plugin 的 `stat` 回傳形狀（只列用得到的欄位）。它跟隨 symlink，時間戳是
 * epoch 毫秒、與 JS `Date` 同一刻度；檔案系統給不出建立時刻時該欄位為 null。
 */
export interface FileStat {
  isDirectory: boolean
  birthtime: number | null
}

export function statPath(path: string): Promise<FileStat> {
  return invoke<FileStat>('plugin:fs|stat', { path })
}

/**
 * 解開路徑中的 symlink，取得它實際指向的位置。外殼走 Rust `std::fs::canonicalize`，
 * 路徑必須既存——不存在或讀不到時 reject。
 */
export function canonicalPath(path: string): Promise<string> {
  return invoke<string>('canonical_path', { path })
}

/**
 * 原生資料夾選擇：外殼回「選定路徑／取消／開不起來」三選一，這裡只收束成
 * 一個聯集，映射成 `PickFolderOutcome` 是上一層（folder-picker.ts）的事。
 */
export type PickFolderShellOutcome
  = { ok: true, path: string | null }
    | { ok: false, message: string }

export async function pickFolder(): Promise<PickFolderShellOutcome> {
  try {
    const path = await invoke<string | null>('pick_folder')
    return { ok: true, path }
  }
  catch (error) {
    return { ok: false, message: describe(error) }
  }
}

export type OpenInFileManagerShellOutcome
  = { ok: true }
    | { ok: false, message: string }

export async function openInFileManager(path: string): Promise<OpenInFileManagerShellOutcome> {
  try {
    await invoke('open_in_file_manager', { path })
    return { ok: true }
  }
  catch (error) {
    return { ok: false, message: describe(error) }
  }
}

export type OpenUrlShellOutcome
  = { ok: true }
    | { ok: false, message: string }

/**
 * `open_url` 指令簽章為 `url: String, with: Option<String>`；`with` 指定的是
 * 用哪個外部程式開（例如特定瀏覽器），本張不需要，明確傳 `null` 對應 Rust 端的
 * `None`（不省略此欄——`Option` 欄位省略與否是否等價於 `null` 屬 Tauri 巨集內部
 * 行為，不假設）。
 */
export async function openUrl(url: string): Promise<OpenUrlShellOutcome> {
  try {
    await invoke('plugin:opener|open_url', { url, with: null })
    return { ok: true }
  }
  catch (error) {
    return { ok: false, message: describe(error) }
  }
}

export interface WatchOptions {
  recursive: boolean
  delayMs: number
}

/**
 * fs plugin 的延遲合併監看（`plugin:fs|watch`）：事件內容只暴露路徑陣列——種類
 * （新增／修改／刪除）與 attrs 是上層做粗粒度合併通知時用不到的細節，收在這裡
 * 就不外洩給呼叫端。回傳的監看編號是外殼配的 Resource id，取消監看時原樣交回。
 */
export async function watchPaths(
  paths: string[],
  options: WatchOptions,
  onEvent: (paths: string[]) => void,
): Promise<number> {
  const channel = new Channel<{ paths: string[] }>()
  channel.onmessage = event => onEvent(event.paths)
  return invoke<number>('plugin:fs|watch', {
    paths,
    options: { recursive: options.recursive, delayMs: options.delayMs },
    onEvent: channel,
  })
}

/** 監看編號即 fs plugin 配出的 Resource id，取消監看走它通用的資源釋放指令 */
export function unwatchPaths(rid: number): Promise<void> {
  return invoke('plugin:resources|close', { rid })
}

// 三個答案在一個 process 內不會變，問一次就夠。快取的是「問到的值」而不是那一趟
// 詢問本身——快取住失敗的詢問等於這個 process 之後每次都拿到同一個失敗，Settings
// 關掉再開也不會好。
let cachedConfigRoot: string | null = null
let cachedHome: string | null = null

/**
 * 設定目錄的平台分支由外殼回答：Tauri 的 config 目錄在三個平台上分別是
 * `~/Library/Application Support`、`%APPDATA%`、`$XDG_CONFIG_HOME`（缺則 `~/.config`）
 * ——與 web 形態的設定目錄解析逐一對齊，兩形態因此落在同一個資料夾。
 */
export async function configRoot(): Promise<string> {
  cachedConfigRoot ??= await configDir()
  return cachedConfigRoot
}

export async function homePath(): Promise<string> {
  cachedHome ??= await homeDir()
  return cachedHome
}

export function joinPath(...parts: string[]): Promise<string> {
  return join(...parts)
}

/**
 * 使用者貼進來的路徑：展開 `~` 後交給外殼正規化。
 * 外殼的 normalize 沿用 Node.js 的行為保留結尾分隔符，清單的識別鍵不能帶它，這裡收掉。
 */
export async function resolveUserPath(input: string): Promise<string> {
  const expanded = expandHome(input, await homePath())
  const normalized = await normalize(expanded)
  return normalized.replace(/(.)[/\\]+$/, '$1')
}

let cachedPlatform: string | null = null

/** 外殼回的是 Rust `std::env::consts::OS`：`macos`／`windows`／`linux`… */
async function hostPlatform(): Promise<string> {
  cachedPlatform ??= await invoke<string>('host_platform')
  return cachedPlatform
}

export async function isMacOS(): Promise<boolean> {
  return (await hostPlatform()) === 'macos'
}

export async function isWindows(): Promise<boolean> {
  return (await hostPlatform()) === 'windows'
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
