import type { ExecFileException } from 'node:child_process'
import type { ChangeListProbe, ProbeFailure } from '../../src/api/types'
import { execFile } from 'node:child_process'
import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

/**
 * route 共用的 CLI 呼叫層：解析目標路徑、spawn、把 spawn 層失敗轉成 probe 欄位。
 * 這裡一樣不做任何語意解析——那是 src/api/normalize.ts 的事（design D2）。
 */

const CLI_BIN = 'openspec'
const TIMEOUT_MS = 15_000
const MAX_BUFFER = 4 * 1024 * 1024

interface ExecOutcome {
  error: ExecFileException | null
  stdout: string
  stderr: string
}

/**
 * design D4：env 指定目標專案，未設定時 fallback App repo 自身（dogfooding）。
 * 開發時指向多 change 的測試 repo：`SPECRUN_PROJECT_PATH=/path/to/repo pnpm dev`
 */
export function resolveTargetPath(): string {
  return process.env.SPECRUN_PROJECT_PATH?.trim() || process.cwd()
}

/** 目標路徑 canonical 化；不是既存資料夾時回傳 target-missing 型 probe 骨架 */
export async function resolveTargetDir(): Promise<
  { ok: true, targetPath: string } | { ok: false, probe: ChangeListProbe }
> {
  const requested = resolveTargetPath()
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

export function runCli(args: string[], cwd: string): Promise<ExecOutcome> {
  return new Promise((resolve) => {
    execFile(
      CLI_BIN,
      args,
      { cwd, timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, windowsHide: true },
      (error, stdout, stderr) => resolve({ error, stdout, stderr }),
    )
  })
}

export function toProbeFailure(error: ExecFileException, args: string[]): ProbeFailure {
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
      message: `"${CLI_BIN} ${args.join(' ')}" did not finish within ${TIMEOUT_MS}ms.`,
    }
  }
  return { kind: 'spawn-failed', message: error.message }
}
