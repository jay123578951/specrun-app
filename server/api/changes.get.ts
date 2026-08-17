import type { ChangeListProbe } from '../../src/api/types'
import { readFile } from 'node:fs/promises'
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
  if (!error)
    return { targetPath, exitCode: 0, stdout, stderr, proposals: await readProposals(targetPath, stdout) }

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
 * 每個 change 一個 `proposal.md`，並行讀取（spec：摘錄不得追加 CLI 呼叫，也不得逐一序列等待）。
 * change name 只認 CLI 輸出，不接受任何呼叫端輸入；單筆讀不到就不入表，摘錄退為空。
 */
async function readProposals(targetPath: string, stdout: string): Promise<Record<string, string>> {
  const changesDir = path.join(targetPath, 'openspec', 'changes')
  const entries = await Promise.all(
    changeNames(stdout).map(async name => [name, await readProposal(changesDir, name)] as const),
  )

  const proposals: Record<string, string> = {}
  for (const [name, content] of entries) {
    if (content !== null)
      proposals[name] = content
  }
  return proposals
}

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
