import type {
  ArtifactFileProbe,
  ChangeDetailProbe,
  ChangeDetailResult,
  ChangeListProbe,
  ChangeListResult,
  GatewayError,
  SpecContentResult,
  SpecListResult,
} from '../types'
import { normalizeChangeDetail, normalizeChangeList, normalizeSpecContent, normalizeSpecList } from '../normalize'
import { runCli } from './cli'
import { resolveTarget } from './projects'
import { joinPath, readTextFile, statPath } from './shell'

/**
 * 桌面形態的四條讀取路：跑指令、讀檔、把兩者收成 probe，再交給與 web 形態同一份
 * normalize。這一側不解析也不分類——那些規則住在 src/api/normalize.ts，兩形態共用。
 *
 * 對應的 web 形態實作是 server/api/changes.get.ts、changes/[name].get.ts、
 * specs.get.ts、specs/[id].get.ts；probe 的欄位與各處的降級選擇逐一對齊。
 */

const LIST_ARGS = ['list', '--json']
const SPEC_LIST_ARGS = ['list', '--specs', '--json']

/** 摘錄唯一許可的讀取目標；慣例檔名，與 web 形態同一個選擇 */
const PROPOSAL_FILE = 'proposal.md'

export async function listChanges(): Promise<ChangeListResult> {
  try {
    return await readChangeList()
  }
  catch (error) {
    return { ok: false, targetPath: '', error: callFailed('Could not read the change list.', error) }
  }
}

export async function getChangeDetail(changeName: string): Promise<ChangeDetailResult> {
  try {
    return await readChangeDetail(changeName)
  }
  catch (error) {
    return { ok: false, error: callFailed('Could not load this change.', error) }
  }
}

export async function listSpecs(): Promise<SpecListResult> {
  try {
    return await readSpecList()
  }
  catch (error) {
    return { ok: false, targetPath: '', error: callFailed('Could not read the spec list.', error) }
  }
}

export async function getSpecContent(specId: string): Promise<SpecContentResult> {
  try {
    return await readSpecContent(specId)
  }
  catch (error) {
    return { ok: false, error: callFailed('Could not load this spec.', error) }
  }
}

/**
 * 通道本身出事（外殼拒絕 invoke、CLI 解析鏈自己 reject）時的兜底。四條路對外只回結果、
 * 不丟例外——畫面端沒有 try/catch，例外逸出的後果是載入旗標收不回、頁面停在轉圈。
 * 錯誤分類與四句話與 web 形態同一批（src/api/web-gateway.ts 的同名四個方法）。
 */
function callFailed(message: string, error: unknown): GatewayError {
  return { kind: 'call-failed', message, detail: error instanceof Error ? error.message : String(error) }
}

async function readChangeList(): Promise<ChangeListResult> {
  const target = await resolveTarget()
  if (!target.ok)
    return normalizeChangeList(target.probe)

  const probe = await cliProbe(LIST_ARGS, target.targetPath)
  if (probe.exitCode !== 0)
    return normalizeChangeList(probe)

  const changesDir = await joinPath(target.targetPath, 'openspec', 'changes')
  const dirs = await changeDirs(changesDir, changeNames(probe.stdout))
  // 摘錄與建立時刻都是檔案層直讀、都不追加 CLI 呼叫，彼此併行發出
  const [proposals, createdAt] = await Promise.all([
    collect(dirs, readProposal),
    collect(dirs, readCreatedAt),
  ])

  return normalizeChangeList({ ...probe, proposals, createdAt })
}

async function readChangeDetail(changeName: string): Promise<ChangeDetailResult> {
  const target = await resolveTarget()
  if (!target.ok)
    return normalizeChangeDetail({ ...target.probe, changeName })

  const probe: ChangeDetailProbe = {
    ...await cliProbe(['status', '--change', changeName, '--json'], target.targetPath),
    changeName,
  }
  // change 不存在也走非零結束這條：CLI 把原因放在 stdout 的診斷 payload 裡
  if (probe.exitCode !== 0)
    return normalizeChangeDetail(probe)

  return normalizeChangeDetail({ ...probe, files: await readArtifactFiles(probe.stdout) })
}

async function readSpecList(): Promise<SpecListResult> {
  const target = await resolveTarget()
  if (!target.ok)
    return normalizeSpecList(target.probe)

  return normalizeSpecList(await cliProbe(SPEC_LIST_ARGS, target.targetPath))
}

/**
 * `show <id> --type spec` 的 stdout 就是 spec.md 原文，原樣轉送。用動詞在前的 `show`
 * 而非 `spec show`：兩者輸出相同，但後者已被 CLI 標記 deprecated（同 web 形態的選擇）。
 */
async function readSpecContent(specId: string): Promise<SpecContentResult> {
  const target = await resolveTarget()
  if (!target.ok)
    return normalizeSpecContent({ ...target.probe, specId })

  return normalizeSpecContent({
    ...await cliProbe(['show', specId, '--type', 'spec'], target.targetPath),
    specId,
  })
}

/**
 * 四條路共用的「跑一趟指令 → 造 probe 骨架」。非零結束是跑完了，結束代碼與兩股
 * 輸出原樣搬進去——CLI 以診斷 JSON 失敗時，那份 stdout 正是 normalize 要解析的東西。
 * 沒跑成時 runCli 已分類完，失敗原樣放進 probe。
 */
async function cliProbe(args: string[], targetPath: string): Promise<ChangeListProbe> {
  const outcome = await runCli(args, targetPath)
  if (!outcome.ok)
    return { targetPath, exitCode: null, stdout: '', stderr: '', failure: outcome.failure }

  return { targetPath, exitCode: outcome.exitCode, stdout: outcome.stdout, stderr: outcome.stderr }
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

/**
 * 把 change name 換成各自的目錄路徑，逸出 changes 目錄的丟掉（視同讀不到）。
 * 名字來自使用者的目錄名，逸出一律不讀——與 web 形態同一道防線。
 */
async function changeDirs(changesDir: string, names: string[]): Promise<Array<readonly [string, string]>> {
  const entries = await Promise.all(
    names.map(async name => [name, await joinPath(changesDir, name)] as const),
  )
  return entries.filter(([, dir]) => isInside(changesDir, dir))
}

/**
 * 外殼的 join 會把 `..` 收掉（Tauri path plugin 的 normalize），收完仍落在
 * changes 目錄底下才算數。分隔符不寫死：同一份 code 在 Windows 上跑的是反斜線。
 */
function isInside(parent: string, child: string): boolean {
  if (!child.startsWith(parent))
    return false
  const rest = child.slice(parent.length)
  return rest.startsWith('/') || rest.startsWith('\\')
}

/**
 * 對一批 change 目錄並行套用同一個讀取器，丟掉讀不到（`null`）的項目，收進 `Record`。
 * 摘錄與建立時刻共用這個形狀；各筆同時發出，單筆讀不到不影響其餘。
 */
async function collect<T>(
  dirs: Array<readonly [string, string]>,
  reader: (dir: string) => Promise<T | null>,
): Promise<Record<string, T>> {
  const entries = await Promise.all(
    dirs.map(async ([name, dir]) => [name, await reader(dir)] as const),
  )

  const result: Record<string, T> = {}
  for (const [name, value] of entries) {
    if (value !== null)
      result[name] = value
  }
  return result
}

/** 讀不到就是沒有：摘錄退為空字串，不是錯誤（清單摘錄的降級） */
async function readProposal(changeDir: string): Promise<string | null> {
  try {
    return await readTextFile(await joinPath(changeDir, PROPOSAL_FILE))
  }
  catch {
    return null
  }
}

/**
 * 每個 change 目錄的建立時刻。檔案系統給不出（`null`）、給 `0`、或讀取失敗
 * 一律視為取不到，該 change 不列入表中（normalize 端據此回 `null`）。
 */
async function readCreatedAt(changeDir: string): Promise<number | null> {
  try {
    const { birthtime } = await statPath(changeDir)
    return birthtime !== null && birthtime > 0 ? birthtime : null
  }
  catch {
    return null
  }
}

/** 只讀 `artifactPaths.<id>.existingOutputPaths` 列出的路徑；stdout 不成形時交給 normalize 報錯 */
async function readArtifactFiles(stdout: string): Promise<Record<string, ArtifactFileProbe[]>> {
  const files: Record<string, ArtifactFileProbe[]> = {}

  let artifactPaths: unknown
  try {
    artifactPaths = (JSON.parse(stdout) as Record<string, unknown>)?.artifactPaths
  }
  catch {
    return files
  }
  if (typeof artifactPaths !== 'object' || artifactPaths === null)
    return files

  for (const [id, entry] of Object.entries(artifactPaths as Record<string, unknown>)) {
    const paths = (entry as { existingOutputPaths?: unknown })?.existingOutputPaths
    if (!Array.isArray(paths))
      continue
    files[id] = await Promise.all(
      paths.filter((p): p is string => typeof p === 'string').map(readOne),
    )
  }

  return files
}

async function readOne(path: string): Promise<ArtifactFileProbe> {
  try {
    return { path, content: await readTextFile(path) }
  }
  catch (error) {
    return { path, error: error instanceof Error ? error.message : String(error) }
  }
}
