import type { ExecFileException } from 'node:child_process'
import type { ChangeListProbe } from '../../src/api/types'
import { execFile } from 'node:child_process'
import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

/**
 * `GET /api/changes`：spawn `openspec list --json`，原樣轉送 stdout 與 exit code。
 *
 * 這裡刻意不做任何 normalize——解析與錯誤分類都在 src/api/normalize.ts，
 * M4 的 Tauri 版沒有這個 route，換掉 gateway 實作就能餵同一份純函式（design D1）。
 */

const CLI_BIN = 'openspec'
const TIMEOUT_MS = 15_000
const MAX_BUFFER = 4 * 1024 * 1024

interface ExecOutcome {
  error: ExecFileException | null
  stdout: string
  stderr: string
}

export default defineEventHandler(async (): Promise<ChangeListProbe> => {
  const requested = resolveTargetPath()

  let targetPath: string
  try {
    targetPath = await realpath(requested)
    if (!(await stat(targetPath)).isDirectory())
      throw new Error('not a directory')
  }
  catch {
    return {
      targetPath: path.resolve(requested),
      exitCode: null,
      stdout: '',
      stderr: '',
      failure: { kind: 'target-missing', message: `${requested} is not an existing folder.` },
    }
  }

  const { error, stdout, stderr } = await runCli(targetPath)
  if (!error)
    return { targetPath, exitCode: 0, stdout, stderr }

  // 非 0 exit：CLI 自己回報的失敗，stdout 可能帶診斷 payload → 原樣轉送給 normalize
  if (typeof error.code === 'number')
    return { targetPath, exitCode: error.code, stdout, stderr }

  return {
    targetPath,
    exitCode: null,
    stdout,
    stderr,
    failure: toProbeFailure(error),
  }
})

/**
 * design D4：env 指定目標專案，未設定時 fallback App repo 自身（dogfooding）。
 * 開發時指向多 change 的測試 repo：`SPECRUN_PROJECT_PATH=/path/to/repo pnpm dev`
 */
function resolveTargetPath(): string {
  return process.env.SPECRUN_PROJECT_PATH?.trim() || process.cwd()
}

function runCli(cwd: string): Promise<ExecOutcome> {
  return new Promise((resolve) => {
    execFile(
      CLI_BIN,
      ['list', '--json'],
      { cwd, timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, windowsHide: true },
      (error, stdout, stderr) => resolve({ error, stdout, stderr }),
    )
  })
}

function toProbeFailure(error: ExecFileException): ChangeListProbe['failure'] {
  // macOS GUI app 不繼承 shell PATH 是已知坑（設定頁的 CLI 路徑覆寫留待後續 change）
  if (error.code === 'ENOENT' || error.code === 'EACCES') {
    return {
      kind: 'cli-unavailable',
      message: `Could not run "${CLI_BIN}": ${error.message}`,
    }
  }
  if (error.killed || error.signal) {
    return {
      kind: 'spawn-failed',
      message: `"${CLI_BIN} list --json" did not finish within ${TIMEOUT_MS}ms.`,
    }
  }
  return { kind: 'spawn-failed', message: error.message }
}
