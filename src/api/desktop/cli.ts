import type { VerifyResult } from '../cli-resolve'
import type { CliApplyResult, CliSettings } from '../types'
import type { SpawnLimits } from './shell'
import { CLI_COMMAND, pickCommandPath, pickVersion, resolveWith } from '../cli-resolve'
import { config, persist } from './config-store'
import { homePath, isMacOS, isWindows, resolveUserPath, spawnBin } from './shell'

/**
 * 桌面形態的 openspec 執行檔解析：決策層共用（cli-resolve），這裡只提供
 * 「怎麼跑一個指令」——四個 spawn 點各帶自己的時間與輸出上限。
 * 輸出上限沿用 web 形態同一批 spawn 點的數字（server/utils/openspec-cli.ts 與
 * server/utils/cli-resolver.ts 的 MAX_BUFFER），兩形態吃記憶體的上限一致。
 */

const DATA_MAX_OUTPUT_BYTES = 4 * 1024 * 1024
const SHELL_MAX_OUTPUT_BYTES = 1024 * 1024

/** 資料請求給得寬：專案大時 `list --json` 本來就慢 */
const DATA_LIMITS: SpawnLimits = { timeoutMs: 15_000, maxOutputBytes: DATA_MAX_OUTPUT_BYTES }
/** `--version` 只是探一下活著沒有，不該跟資料請求一樣寬容 */
const VERIFY_LIMITS: SpawnLimits = { timeoutMs: 5_000, maxOutputBytes: SHELL_MAX_OUTPUT_BYTES }
/** 非互動 shell 的 `command -v`：不跑使用者的 rc 檔，只是不想讓它無限期掛著 */
const LOCATE_LIMITS: SpawnLimits = { timeoutMs: 3_000, maxOutputBytes: SHELL_MAX_OUTPUT_BYTES }
/** 互動式 shell 會跑使用者的 rc 檔，可能很慢、也可能印很多；逾時或爆量都視同該段未命中 */
const LOGIN_SHELL_LIMITS: SpawnLimits = { timeoutMs: 3_000, maxOutputBytes: SHELL_MAX_OUTPUT_BYTES }

let resolutionPromise: Promise<CliSettings> | null = null

export function cliSettings(): Promise<CliSettings> {
  resolutionPromise ??= resolveOnce()
  return resolutionPromise
}

/**
 * 解析要單飛（徽章會同時發四趟，不能各跑一次三段降級），但失敗不能留在快取裡
 * ——留著的話這個 process 之後每次取 CLI 設定都拿到同一個失敗，Settings 關掉
 * 再開也不會好。清除前先比對是不是自己那一趟：redetect／applyOverride 會換掉
 * 這個快取，晚到的失敗不得把它們的結果抹掉。
 */
function resolveOnce(): Promise<CliSettings> {
  const pending: Promise<CliSettings> = resolve().catch((error) => {
    if (resolutionPromise === pending)
      resolutionPromise = null
    throw error
  })
  return pending
}

async function currentCliBin(): Promise<string | null> {
  return (await cliSettings()).bin
}

export async function redetect(): Promise<CliSettings> {
  const current = await config()
  current.openspecBin = null
  await persist()

  resolutionPromise = resolveOnce()
  return resolutionPromise
}

export async function applyOverride(input: string): Promise<CliApplyResult> {
  const raw = input.trim()
  if (!raw)
    return { ok: false, message: 'Enter the path to the openspec executable.' }

  const target = await resolveUserPath(raw)
  const result = await verifyBin(target)
  if (!result.ok)
    return { ok: false, message: result.message }

  const current = await config()
  current.openspecBin = target
  await persist()

  const settings: CliSettings = { mode: 'override', bin: target, version: result.version, message: null }
  resolutionPromise = Promise.resolve(settings)
  return { ok: true, settings }
}

interface CliRun {
  ok: boolean
  stdout: string
}

export async function runCli(args: string[], cwd: string): Promise<CliRun> {
  const bin = await currentCliBin()
  if (!bin)
    return { ok: false, stdout: '' }

  const outcome = await spawnBin(bin, args, cwd, DATA_LIMITS)
  if (!outcome.ok || outcome.result.timedOut || outcome.result.truncated || outcome.result.status !== 0)
    return { ok: false, stdout: '' }
  return { ok: true, stdout: outcome.result.stdout }
}

async function resolve(): Promise<CliSettings> {
  const current = await config()
  const [macOS, windows] = await Promise.all([isMacOS(), isWindows()])
  return resolveWith({
    override: current.openspecBin,
    verify: verifyBin,
    // 判準與 web 形態同一句（server/utils/cli-resolver.ts 的 canUseLoginShell），
    // 兩形態才不會在同一台機器上給出不同的偵測結果
    viaLoginShell: macOS ? viaLoginShell : null,
    // Windows 沒有 /bin/sh，spawn 必定失敗；跳過省一趟白花的等待
    locate: windows ? async () => null : locate,
  })
}

/** 失敗訊息要能據以排除問題：逾時、非零結束、連 spawn 都不成立各有各的說法 */
async function verifyBin(bin: string): Promise<VerifyResult> {
  const outcome = await spawnBin(bin, ['--version'], await homePath(), VERIFY_LIMITS)
  if (!outcome.ok)
    return { ok: false, message: `Could not run "${bin} --version": ${outcome.message}` }

  const { result } = outcome
  if (result.timedOut)
    return { ok: false, message: `"${bin} --version" did not finish within ${VERIFY_LIMITS.timeoutMs}ms.` }
  if (result.truncated)
    return { ok: false, message: `"${bin} --version" printed more than ${VERIFY_LIMITS.maxOutputBytes} bytes.` }
  if (result.status !== 0)
    return { ok: false, message: `"${bin} --version" failed: ${firstLine(result.stderr) || `exit code ${result.status}`}` }

  return { ok: true, version: pickVersion(result.stdout) }
}

/**
 * 第一段命中後把命令名還原成絕對路徑：跑一次**非互動** shell 的 `command -v`。
 * 它不讀使用者的設定檔，查的就是 App 自己這個行程當下的環境——與第一段同一份
 * PATH，所以答案必定一致。這不是另一種偵測手段，只用於呈現與釘住結果。
 */
function locate(): Promise<string | null> {
  return askShell(['-c', `command -v ${CLI_COMMAND}`], LOCATE_LIMITS)
}

/**
 * 第二段：借使用者 login shell 的真實 PATH。`-ilc` 會執行使用者自己的 rc 檔，
 * 所以才需要上限；任何失敗（逾時被終止、rc 出錯、命令不存在的非零結束）一律視同未命中。
 * 外層包一層 `/bin/sh -c` 是為了讀得到 `$SHELL`——前端沒有行程環境變數可讀；
 * `exec` 讓 login shell 接管同一個行程，逾時終止時終止到的就是它本身。
 */
function viaLoginShell(): Promise<string | null> {
  return askShell(['-c', `exec "\${SHELL:-/bin/zsh}" -ilc "command -v ${CLI_COMMAND}"`], LOGIN_SHELL_LIMITS)
}

async function askShell(args: string[], limits: SpawnLimits): Promise<string | null> {
  const outcome = await spawnBin('/bin/sh', args, await homePath(), limits)
  if (!outcome.ok || outcome.result.timedOut || outcome.result.truncated || outcome.result.status !== 0)
    return null
  return pickCommandPath(outcome.result.stdout)
}

function firstLine(text: string): string {
  return text.split('\n').map(line => line.trim()).find(Boolean) ?? ''
}
