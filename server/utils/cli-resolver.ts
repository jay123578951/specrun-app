import type { ExecFileException } from 'node:child_process'
import type { CliSettings } from '../../src/api/types'
import { execFile } from 'node:child_process'
import { access, constants } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { expandHome, readConfig, writeConfig } from './app-config'

/**
 * openspec 執行檔的單一解析處（design D3／D4）：伺服端持有、可於執行期更換，
 * 呼叫端（openspec-cli 的 runCli）只問「現在該 spawn 誰」。
 *
 * 優先序：使用者持久化的明示覆寫 ＞ 自動偵測。自動偵測三段降級——
 * ① 直接以命令名執行，吃行程本身的 PATH（`pnpm dev` 形態第一段就命中）
 * ② `$SHELL -ilc 'command -v openspec'` 借使用者 login shell 的真實 PATH
 *    （macOS GUI App 從 Finder 啟動時 PATH 只有 /usr/bin:/bin:/usr/sbin:/sbin）
 * ③ 皆未命中則回報不可用，引導手動指定。
 *
 * MUST NOT 維護一份寫死的常見安裝位置清單（spec openspec-gateway）——那要永久
 * 追著套件管理器生態跑，而 login shell 已一次涵蓋所有正確安裝的情況。
 */

export const CLI_COMMAND = 'openspec'

/** `--version` 只是探一下活著沒有，不該跟資料請求一樣寬容 */
const VERIFY_TIMEOUT_MS = 5_000
/** 互動式 shell 會跑使用者的 rc 檔，可能很慢；逾時視同該段未命中（design 風險欄） */
const LOGIN_SHELL_TIMEOUT_MS = 3_000
const MAX_BUFFER = 1024 * 1024

export type VerifyResult
  = { ok: true, version: string }
    | { ok: false, message: string }

export interface ResolveDeps {
  /** 持久化的明示覆寫；有值時不進行任何偵測 */
  override: string | null
  /** 以 `--version` 判定某執行檔可用與否 */
  verify: (bin: string) => Promise<VerifyResult>
  /** 借 login shell 取絕對路徑；此環境不具備該能力時為 null（第 2 段整段跳過） */
  viaLoginShell: (() => Promise<string | null>) | null
  /** 把命令名還原成絕對路徑，供第一段命中時呈現用 */
  locate: () => Promise<string | null>
}

/** 能力判定在 server（平台分支），前端不寫死——比照 folder-picker 的 canPickFolder() */
export function canUseLoginShell(): boolean {
  return process.platform === 'darwin'
}

/**
 * `command -v` 的輸出可能混著 rc 檔的雜訊（互動式 shell 的 motd、版本管理器提示）；
 * 命令位置永遠是最後才印出的那一行，所以只取最後一行非空白內容。
 * 取到的路徑仍要通過 `--version` 才採用——雜訊碰巧長得像路徑也過不了那一關。
 */
export function pickCommandPath(stdout: string): string | null {
  const lines = stdout.split('\n').map(line => line.trim()).filter(Boolean)
  return lines.at(-1) ?? null
}

/** `--version` 的輸出取第一行非空白內容當版本字串 */
export function pickVersion(stdout: string): string {
  return stdout.split('\n').map(line => line.trim()).find(Boolean) ?? 'unknown version'
}

/**
 * 解析本身（spawn 全部注入，才測得動降級順序）。覆寫存在時直接採用並回報其驗證結果：
 * 失效的覆寫不會偷偷退回自動偵測——那會讓使用者以為設定還生效（spec「覆寫路徑已失效」）。
 */
export async function resolveWith(deps: ResolveDeps): Promise<CliSettings> {
  if (deps.override) {
    const result = await deps.verify(deps.override)
    return result.ok
      ? { mode: 'override', bin: deps.override, version: result.version, message: null }
      : { mode: 'override', bin: deps.override, version: null, message: result.message }
  }

  const direct = await deps.verify(CLI_COMMAND)
  if (direct.ok) {
    // 命令名跑得動只證明「有」，畫面上還要看得出究竟是哪一個檔案（spec 自動偵測成功要顯示絕對路徑）
    // ——查行程自己的 PATH 把它還原成絕對路徑，還原不出來才退回命令名
    const absolute = await deps.locate()
    return { mode: 'auto', bin: absolute ?? CLI_COMMAND, version: direct.version, message: null }
  }

  if (deps.viaLoginShell) {
    const found = await deps.viaLoginShell()
    if (found) {
      const viaShell = await deps.verify(found)
      if (viaShell.ok)
        return { mode: 'auto', bin: found, version: viaShell.version, message: null }
    }
  }

  return {
    mode: 'auto',
    bin: null,
    version: null,
    message: deps.viaLoginShell
      ? `Could not find "${CLI_COMMAND}" on PATH or through your login shell. ${direct.message}`
      : `Could not find "${CLI_COMMAND}" on PATH. ${direct.message}`,
  }
}

/**
 * 把命令名還原成絕對路徑：逐一走過 PATH 上的目錄看有沒有可執行的同名檔案。
 * 這不是 spec 禁止的「寫死的常見安裝位置清單」——查的是行程當下真正的 PATH，
 * 而且只用於呈現與釘住結果，不是另一種偵測手段。
 */
export async function resolveOnPath(
  command: string,
  pathEnv: string | undefined,
  isExecutable: (file: string) => Promise<boolean>,
): Promise<string | null> {
  for (const dir of (pathEnv ?? '').split(path.delimiter)) {
    if (!dir)
      continue
    const candidate = path.join(dir, command)
    if (await isExecutable(candidate))
      return candidate
  }
  return null
}

/** 首次取用時才解析；之後整個 process 共用同一份結果（比照 project-state 的持有方式） */
let resolutionPromise: Promise<CliSettings> | null = null
/**
 * 最後一次解析結果的同步快照。toProbeFailure 是同步的、又需要知道當時 spawn 的是誰，
 * 而它永遠跑在 runCli 取得解析結果之後——這份快照因此一定已經填好。
 */
let snapshot: CliSettings | null = null

export function cliSettings(): Promise<CliSettings> {
  resolutionPromise ??= resolve()
  return resolutionPromise
}

/** 同步快照；尚未解析過時為 null */
export function cliSnapshot(): CliSettings | null {
  return snapshot
}

export async function currentCliBin(): Promise<string | null> {
  return (await cliSettings()).bin
}

/**
 * 重新偵測：清掉快取的解析結果並重跑三段降級。同時撤掉持久化的明示覆寫——
 * 兩種模式互斥，回到自動偵測就不該有覆寫留著（否則下次啟動又跳回手動模式）。
 */
export async function redetect(): Promise<CliSettings> {
  await persistOverride(null)
  resolutionPromise = resolve()
  return resolutionPromise
}

export type ApplyResult
  = { ok: true, settings: CliSettings }
    | { ok: false, message: string }

/**
 * 驗證並套用（design D6）：`--version` 成功才寫 config 並更換執行期狀態；
 * 失敗一律不寫入、目前生效的解析結果原封不動。
 */
export async function applyOverride(input: string): Promise<ApplyResult> {
  const target = expandHome(input.trim())
  if (!target)
    return { ok: false, message: 'Enter the path to the openspec executable.' }

  const result = await verifyBin(target)
  if (!result.ok)
    return { ok: false, message: result.message }

  await persistOverride(target)
  const settings: CliSettings = {
    mode: 'override',
    bin: target,
    version: result.version,
    message: null,
  }
  resolutionPromise = Promise.resolve(settings)
  snapshot = settings
  return { ok: true, settings }
}

/** 驗證通道（spec openspec-gateway「CLI 執行檔的驗證通道」）；不改變目前生效的解析結果 */
export function verifyBin(bin: string): Promise<VerifyResult> {
  return new Promise((resolve) => {
    execFile(
      bin,
      ['--version'],
      { timeout: VERIFY_TIMEOUT_MS, maxBuffer: MAX_BUFFER, windowsHide: true },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ ok: true, version: pickVersion(stdout) })
          return
        }
        resolve({ ok: false, message: describeVerifyError(error, bin, stderr) })
      },
    )
  })
}

async function resolve(): Promise<CliSettings> {
  const config = await readConfig()
  const settings = await resolveWith({
    override: config.openspecBin,
    verify: verifyBin,
    viaLoginShell: canUseLoginShell() ? viaLoginShell : null,
    locate: () => resolveOnPath(CLI_COMMAND, process.env.PATH, isExecutable),
  })
  snapshot = settings
  return settings
}

/**
 * `-ilc` 會執行使用者自己的 shell 設定檔——與 folder-picker spawn osascript 同級的
 * 本機操作，但只在第一段未命中時才付這個成本（開發期第一段就命中）。
 * 任何失敗（逾時被 kill、rc 檔出錯、命令不存在的 exit 1）一律視同未命中。
 */
function viaLoginShell(): Promise<string | null> {
  const shell = process.env.SHELL?.trim() || '/bin/zsh'
  return new Promise((resolve) => {
    execFile(
      shell,
      ['-ilc', `command -v ${CLI_COMMAND}`],
      { timeout: LOGIN_SHELL_TIMEOUT_MS, maxBuffer: MAX_BUFFER, windowsHide: true },
      (error, stdout) => resolve(error ? null : pickCommandPath(stdout)),
    )
  })
}

async function isExecutable(file: string): Promise<boolean> {
  try {
    await access(file, constants.X_OK)
    return true
  }
  catch {
    return false
  }
}

/** 只動 openspecBin 一欄：設定檔的其餘內容由 project-state 持有，讀回來原樣寫回去 */
async function persistOverride(bin: string | null): Promise<void> {
  try {
    const config = await readConfig()
    await writeConfig({ ...config, openspecBin: bin })
  }
  catch {
    // 寫不進去（唯讀家目錄、配額滿）不影響本 session 已經生效的解析結果
  }
}

/** 失敗訊息要能據以排除問題：分成「找不到／不可執行／逾時」三種說法，其餘附系統訊息 */
function describeVerifyError(error: ExecFileException, bin: string, stderr: string): string {
  if (error.code === 'ENOENT')
    return `"${bin}" does not exist.`
  if (error.code === 'EACCES')
    return `"${bin}" is not executable.`
  if (error.killed || error.signal)
    return `"${bin} --version" did not finish within ${VERIFY_TIMEOUT_MS}ms.`

  const detail = stderr.trim().split('\n').map(line => line.trim()).find(Boolean)
  return `"${bin} --version" failed: ${detail || error.message}`
}
