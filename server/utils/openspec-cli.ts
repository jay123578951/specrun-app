import type { ExecFileException } from 'node:child_process'
import type { ChangeListProbe, ProbeFailure } from '../../src/api/types'
import { execFile } from 'node:child_process'
import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { CLI_COMMAND, cliSnapshot, currentCliBin } from './cli-resolver'
import { currentProjectPath } from './project-state'

/**
 * route 共用的 CLI 呼叫層：解析目標路徑、spawn、把 spawn 層失敗轉成 probe 欄位。
 * 這裡一樣不做任何語意解析——那是 src/api/normalize.ts 的事（design D2）。
 */

const TIMEOUT_MS = 15_000
const MAX_BUFFER = 4 * 1024 * 1024

interface ExecOutcome {
  error: ExecFileException | null
  stdout: string
  stderr: string
}

/**
 * 目標路徑取自伺服端的執行期狀態（C5 起可切換，見 project-state）；
 * 不是既存資料夾、或根本沒有目標專案時，回傳 target-missing 型 probe 骨架。
 */
export async function resolveTargetDir(): Promise<
  { ok: true, targetPath: string } | { ok: false, probe: ChangeListProbe }
> {
  const requested = await currentProjectPath()
  if (!requested) {
    return {
      ok: false,
      probe: {
        targetPath: '',
        exitCode: null,
        stdout: '',
        stderr: '',
        failure: { kind: 'target-missing', message: 'No project is selected.' },
      },
    }
  }

  try {
    const targetPath = await realpath(requested)
    if (!(await stat(targetPath)).isDirectory())
      throw new Error('not a directory')
    return { ok: true, targetPath }
  }
  catch {
    return {
      ok: false,
      probe: {
        targetPath: path.resolve(requested),
        exitCode: null,
        stdout: '',
        stderr: '',
        failure: { kind: 'target-missing', message: `${requested} is not an existing folder.` },
      },
    }
  }
}

/**
 * 執行檔取自伺服端的執行期解析狀態（cli-resolver）：使用者覆寫 ＞ 自動偵測。
 * 解析全數未命中時連 spawn 都不成立——就地造一個 ENOENT，讓下游的錯誤分類
 * 照原本那條路走到 cli-unavailable，呼叫端不必為這個情形另開分支。
 */
export async function runCli(args: string[], cwd: string): Promise<ExecOutcome> {
  const bin = await currentCliBin()
  if (!bin)
    return { error: unresolvedError(), stdout: '', stderr: '' }

  return new Promise((resolve) => {
    execFile(
      bin,
      args,
      { cwd, timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, windowsHide: true },
      (error, stdout, stderr) => resolve({ error, stdout, stderr }),
    )
  })
}

function unresolvedError(): ExecFileException {
  const message = cliSnapshot()?.message ?? `Could not find "${CLI_COMMAND}".`
  return Object.assign(new Error(message), { code: 'ENOENT', cmd: CLI_COMMAND })
}

/**
 * `cli-unavailable` 只在「解析全數失敗」或「解析出來的執行檔跑不起來」時成立
 * ——前者的訊息已由 cli-resolver 造好（自成一句，不再包一層），後者才附系統訊息。
 * 使用者可於 Settings 指定路徑，因此這類錯誤的出口是設定，不是重裝。
 */
export function toProbeFailure(error: ExecFileException, args: string[]): ProbeFailure {
  const bin = cliSnapshot()?.bin
  const label = bin ?? CLI_COMMAND
  if (error.code === 'ENOENT' || error.code === 'EACCES') {
    return {
      kind: 'cli-unavailable',
      message: bin ? `Could not run "${label}": ${error.message}` : error.message,
    }
  }
  if (error.killed || error.signal) {
    return {
      kind: 'spawn-failed',
      message: `"${label} ${args.join(' ')}" did not finish within ${TIMEOUT_MS}ms.`,
    }
  }
  return { kind: 'spawn-failed', message: error.message }
}
