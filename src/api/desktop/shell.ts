import { invoke } from '@tauri-apps/api/core'
import { configDir, homeDir, join, normalize } from '@tauri-apps/api/path'
import { expandHome } from '../app-config'

/**
 * 桌面外殼的通道薄層：檔案、路徑、外部指令三類，一律只做型別與錯誤形狀的收束，
 * 不放任何商業規則。
 *
 * 檔案通道走 Tauri 官方的 fs plugin（Rust 端已註冊），這裡直接 invoke 它的指令
 * 而不另外裝 JS binding 套件——`@tauri-apps/api` 的 invoke 已足夠，指令名與參數
 * 形狀由 plugin 版本決定（見 Cargo.toml 的 tauri-plugin-fs）。
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

export async function spawnBin(
  program: string,
  args: string[],
  cwd: string,
  limits: SpawnLimits,
): Promise<SpawnOutcome> {
  try {
    const result = await invoke<SpawnResult>('spawn_bin', {
      program,
      args,
      cwd,
      timeoutMs: limits.timeoutMs,
      maxOutputBytes: limits.maxOutputBytes,
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

export interface DirEntry {
  name: string
  isDirectory: boolean
  isFile: boolean
  isSymlink: boolean
}

export function readDir(path: string): Promise<DirEntry[]> {
  return invoke<DirEntry[]>('plugin:fs|read_dir', { path })
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
