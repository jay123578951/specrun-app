import type { ChangeListProbe } from '../../src/api/types'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { resolveTargetDir, runCli, toProbeFailure } from '../utils/openspec-cli'

/**
 * `GET /api/changes`：spawn `openspec list --json`，原樣轉送 stdout 與 exit code，
 * 再補一輪 proposal 直讀供卡片摘錄用。
 *
 * 這裡刻意不做任何 normalize——解析與錯誤分類都在 src/api/normalize.ts，
 * M4 的 Tauri 版沒有這個 route，換掉 gateway 實作就能餵同一份純函式（design D1）。
 */

const ARGS = ['list', '--json']

/** 摘錄唯一許可的讀取目標；慣例檔名，與 parked 那側的 FALLBACK_PROPOSAL 同一個選擇（design D1） */
const PROPOSAL_FILE = 'proposal.md'

export default defineEventHandler(async (): Promise<ChangeListProbe> => {
  const target = await resolveTargetDir()
  if (!target.ok)
    return target.probe

  const targetPath = target.targetPath
  const { error, stdout, stderr } = await runCli(ARGS, targetPath)
  if (!error) {
    const changesDir = path.join(targetPath, 'openspec', 'changes')
    const names = changeNames(stdout)
    // 摘錄與建立時刻都是檔案層直讀、都不追加 CLI 呼叫，彼此併行發出
    const [proposals, createdAt] = await Promise.all([
      readPerChange(changesDir, names, readProposal),
      readPerChange(changesDir, names, readCreatedAt),
    ])
    return { targetPath, exitCode: 0, stdout, stderr, proposals, createdAt }
  }

  // 非 0 exit：CLI 自己回報的失敗，stdout 可能帶診斷 payload → 原樣轉送給 normalize
  if (typeof error.code === 'number')
    return { targetPath, exitCode: error.code, stdout, stderr }

  return {
    targetPath,
    exitCode: null,
    stdout,
    stderr,
    failure: toProbeFailure(error, ARGS),
  }
})

/**
 * stdout 的形狀判定留給 normalize——這裡只要拿得到名字就讀，拿不到就不讀。
 * 解析失敗不能讓清單掛掉：真正的錯誤分類在 normalize 依同一份 stdout 做。
 */
function changeNames(stdout: string): string[] {
  try {
    const payload: unknown = JSON.parse(stdout)
    const changes = (payload as { changes?: unknown })?.changes
    if (!Array.isArray(changes))
      return []
    return changes
      .map(raw => (raw as { name?: unknown })?.name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0)
  }
  catch {
    return []
  }
}

/**
 * 對一批 change name 並行套用同一個讀取器，丟掉讀不到（`null`）的項目，收進 `Record`。
 * proposal 摘錄與建立時刻共用這個形狀；各筆仍是同時發出、不逐一序列等待。
 */
async function readPerChange<T>(
  changesDir: string,
  names: string[],
  reader: (changesDir: string, name: string) => Promise<T | null>,
): Promise<Record<string, T>> {
  const entries = await Promise.all(
    names.map(async name => [name, await reader(changesDir, name)] as const),
  )

  const result: Record<string, T> = {}
  for (const [name, value] of entries) {
    if (value !== null)
      result[name] = value
  }
  return result
}

/**
 * 每個 change 目錄的 `birthtimeMs`。`0` 或讀取失敗一律視為取不到，
 * 該 change 不列入表中（normalize 端據此回 `null`）。
 */
async function readCreatedAt(changesDir: string, name: string): Promise<number | null> {
  const changeDir = path.resolve(changesDir, name)
  // change name 來自 CLI 輸出、逸出該目錄一律視同讀不到（同 readProposal 的路徑逸出防線）
  if (!changeDir.startsWith(`${changesDir}${path.sep}`))
    return null

  try {
    const { birthtimeMs } = await stat(changeDir)
    return birthtimeMs > 0 ? birthtimeMs : null
  }
  catch {
    return null
  }
}

/** 讀不到就是沒有：摘錄退為空字串，不是錯誤（spec 清單摘錄的降級） */
async function readProposal(changesDir: string, name: string): Promise<string | null> {
  const changeDir = path.resolve(changesDir, name)
  const file = path.resolve(changeDir, PROPOSAL_FILE)
  // change name 來自使用者的目錄名，逸出該 change 目錄一律視同讀取失敗（design D4）
  if (!file.startsWith(`${changeDir}${path.sep}`) || !changeDir.startsWith(`${changesDir}${path.sep}`))
    return null

  try {
    return await readFile(file, 'utf8')
  }
  catch {
    return null
  }
}
