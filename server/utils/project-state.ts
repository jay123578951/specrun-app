import type { AppConfig } from './app-config'
import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { expandHome, readConfig, writeConfig } from './app-config'

/**
 * 「目前專案」的單一持有處（design D1）：從 C5 起這是伺服端的執行期狀態，
 * 不再是每次呼叫重算的純函式——切換是一個明確動作，所有 route 都跟著它走。
 *
 * 啟動優先序（design D3）：env（dev override）> 設定檔 lastActivePath >
 * cwd（僅當它是 openspec 專案，dogfooding）> 無目標專案。
 * env／cwd 得出的專案若不在清單中，以「暫時項」存在，絕不寫回設定檔。
 */

const ENV_KEY = 'SPECRUN_PROJECT_PATH'

interface ProjectState {
  config: AppConfig
  /** canonical 路徑；null＝無目標專案（空清單引導） */
  current: string | null
  /** current 不在持久化清單中——側欄以暫時項呈現 */
  temporary: boolean
}

/** 首次取用時才初始化；之後整個 process 共用同一份狀態 */
let statePromise: Promise<ProjectState> | null = null

function state(): Promise<ProjectState> {
  statePromise ??= initState()
  return statePromise
}

async function initState(): Promise<ProjectState> {
  const config = await readConfig()

  const fromEnv = process.env[ENV_KEY]?.trim()
  if (fromEnv) {
    // env 指的路徑不存在也照樣採用——失效由後續的 target-missing probe 說話，不在這裡吞掉
    const current = (await canonical(fromEnv)) ?? path.resolve(expandHome(fromEnv))
    return { config, current, temporary: !config.projects.includes(current) }
  }

  if (config.lastActivePath) {
    const current = config.lastActivePath
    return { config, current, temporary: !config.projects.includes(current) }
  }

  const cwd = (await canonical(process.cwd())) ?? process.cwd()
  if (await isOpenSpecProject(cwd))
    return { config, current: cwd, temporary: !config.projects.includes(cwd) }

  return { config, current: null, temporary: false }
}

export async function currentProjectPath(): Promise<string | null> {
  return (await state()).current
}

export interface ProjectListEntry {
  path: string
  current: boolean
  temporary: boolean
}

/** 側欄清單的原料：持久化清單原序，暫時項（若有）置頂 */
export async function projectEntries(): Promise<ProjectListEntry[]> {
  const current = await state()
  const entries = current.config.projects.map(each => ({
    path: each,
    current: each === current.current,
    temporary: false,
  }))

  if (current.current && current.temporary)
    entries.unshift({ path: current.current, current: true, temporary: true })

  return entries
}

export type AddOutcome
  = { ok: true, path: string, alreadyExisted: boolean }
    | { ok: false, message: string }

/**
 * 加入即切換（spec 加入專案）。驗證只有兩關：既存資料夾、含 `openspec/`；
 * canonical 比對已在清單中則不重複加入，直接切過去。
 */
export async function addProject(input: string): Promise<AddOutcome> {
  const raw = input.trim()
  if (!raw)
    return { ok: false, message: 'Enter a project folder path.' }

  const resolved = await canonical(expandHome(raw))
  if (!resolved || !(await isDirectory(resolved)))
    return { ok: false, message: 'That path is not an existing folder.' }
  if (!(await isOpenSpecProject(resolved)))
    return { ok: false, message: 'That folder has no openspec/ directory.' }

  const current = await state()
  const alreadyExisted = current.config.projects.includes(resolved)
  if (!alreadyExisted)
    current.config.projects = [...current.config.projects, resolved]

  current.current = resolved
  current.temporary = false
  current.config.lastActivePath = resolved
  await persist(current)

  return { ok: true, path: resolved, alreadyExisted }
}

/**
 * 只動清單、不動磁碟（spec 移除專案）。移除目前專案時接手清單第一個，
 * 清空則進無目標專案狀態。
 */
export async function removeProject(input: string): Promise<void> {
  const current = await state()
  const target = await resolveKnownPath(input, current.config.projects, current.current)

  current.config.projects = current.config.projects.filter(each => each !== target)
  if (current.current === target) {
    current.current = current.config.projects[0] ?? null
    current.temporary = false
    current.config.lastActivePath = current.current
  }

  await persist(current)
}

export type SwitchOutcome
  = { ok: true, path: string }
    | { ok: false, message: string }

export interface SwitchOptions {
  /**
   * 這個行程手上的設定是啟動時讀進去的，整檔寫回會蓋掉外殼那一側之後寫的內容。
   * 桌面形態由外殼持有寫入權，切換只借這裡更新執行期狀態與 watcher。
   *
   * 帶這一欄＝呼叫端已經驗過也寫過設定檔，因此成員資格也要以磁碟上那一份為準：
   * 見 switchProject 內的重讀。
   */
  skipConfigWrite?: boolean
}

/** 切換到清單中（含暫時項）的專案；路徑已失效照樣切過去，錯誤留給主區呈現 */
export async function switchProject(input: string, options: SwitchOptions = {}): Promise<SwitchOutcome> {
  const current = await state()
  // 寫入權在呼叫端時，這裡手上的清單是啟動時讀進去的舊快照：不重讀就會拿舊清單
  // 否決掉對方剛加入的專案，而這份快照在本行程的生命週期內永遠不會自己對齊。
  //
  // 重讀只用來判成員資格，不覆寫 current.config：readConfig 讀不到檔案時回的是
  // 空設定而不是拋錯，覆寫上去等於把本行程的設定整份換成空的，之後任何一次落盤
  // （web 那一側的增／刪／切）都會把這份空設定寫回磁碟。
  const disk = options.skipConfigWrite ? await readConfig() : current.config

  const target = await resolveKnownPath(input, disk.projects, current.current)

  const persisted = disk.projects.includes(target)
  if (!persisted && !(current.temporary && current.current === target))
    return { ok: false, message: 'That project is not in the list.' }

  current.current = target
  current.temporary = !persisted
  // 暫時項不寫回 lastActivePath——dev 路徑不該汙染下次啟動的優先序（design D3）
  if (persisted)
    current.config.lastActivePath = target

  if (!options.skipConfigWrite)
    await persist(current)
  return { ok: true, path: target }
}

/**
 * 清單裡的路徑已是 canonical；但資料夾若已被搬走 realpath 會失敗，
 * 此時退回原字串才比對得到自己那一項（失效專案仍要可切換、可移除）。
 */
async function resolveKnownPath(input: string, projects: string[], currentPath: string | null): Promise<string> {
  const raw = input.trim()
  if (projects.includes(raw) || currentPath === raw)
    return raw
  return (await canonical(expandHome(raw))) ?? path.resolve(expandHome(raw))
}

/** 持久化失敗＝這次的清單只活在本 session，不因此讓操作失敗（無 UI 可呈現，靜默降級） */
async function persist(current: ProjectState): Promise<void> {
  try {
    await writeConfig(current.config)
  }
  catch {
    // 設定寫不進去（唯讀家目錄、配額滿）不影響當下操作
  }
}

async function canonical(target: string): Promise<string | null> {
  try {
    return await realpath(target)
  }
  catch {
    return null
  }
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory()
  }
  catch {
    return false
  }
}

export function isOpenSpecProject(dir: string): Promise<boolean> {
  return isDirectory(path.join(dir, 'openspec'))
}
