import type { WorkflowFilesComparison, WorkflowFilesEntry, WorkflowFilesUpdateResult } from './types'
import { stripAnsi } from './normalize'

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/
const GENERATED_BY = /^[ \t]*generatedBy:[ \t]*["']?([^"'\s]+)["']?[ \t]*$/m

const HEAD_CHUNK_BYTES = 512
const HEAD_MAX_BYTES = 8192

export async function readSkillHead(readChunk: (len: number) => Promise<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder()
  let text = ''
  for (let total = 0; total < HEAD_MAX_BYTES;) {
    const chunk = await readChunk(Math.min(HEAD_CHUNK_BYTES, HEAD_MAX_BYTES - total))
    if (chunk.length === 0)
      break
    total += chunk.length
    text += decoder.decode(chunk, { stream: true })
    if (FRONTMATTER.test(text) || (text.length >= 3 && !text.startsWith('---')))
      break
  }
  return text
}

export function extractGeneratedBy(skillText: string): string | null {
  const block = FRONTMATTER.exec(skillText)?.[1]
  return block ? (GENERATED_BY.exec(block)?.[1] ?? null) : null
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0)
      return diff
  }
  return 0
}

export function oldestVersion(versions: (string | null)[]): string | null {
  let oldest: string | null = null
  for (const v of versions) {
    if (v && (oldest === null || compareVersions(v, oldest) < 0))
      oldest = v
  }
  return oldest
}

export function compareWithCli(version: string, cliVersion: string | null): WorkflowFilesComparison | null {
  if (!cliVersion)
    return null
  const diff = compareVersions(version, cliVersion)
  return diff < 0 ? 'behind' : diff > 0 ? 'ahead' : 'current'
}

export function buildWorkflowEntry(
  input: { path: string, exists: boolean, generatedBy: (string | null)[] },
  cliVersion: string | null,
): WorkflowFilesEntry {
  if (!input.exists)
    return { path: input.path, version: null, status: 'missing' }
  const version = oldestVersion(input.generatedBy)
  if (version === null)
    return { path: input.path, version: null, status: 'unset' }
  return { path: input.path, version, status: compareWithCli(version, cliVersion) }
}

export interface UpdateRun {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut?: boolean
  truncated?: boolean
  failureMessage?: string
}

export function parseUpdateResult(run: UpdateRun): WorkflowFilesUpdateResult {
  if (run.failureMessage)
    return { ok: false, message: run.failureMessage }
  if (run.timedOut)
    return { ok: false, message: 'Update timed out.' }
  if (run.truncated)
    return { ok: false, message: 'Update output was truncated.' }
  const stdout = stripAnsi(run.stdout)
  const stderr = stripAnsi(run.stderr)
  if (run.exitCode !== 0) {
    const text = (stderr.trim() || stdout.trim()).slice(0, 500)
    return { ok: false, message: text || `openspec update exited with code ${run.exitCode}.` }
  }
  const warning = `${stdout}\n${stderr}`
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('⚠'))
    .join('\n')
  return warning ? { ok: true, warning } : { ok: true }
}
