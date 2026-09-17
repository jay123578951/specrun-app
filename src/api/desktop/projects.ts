import type { ChangeListProbe, ProjectActionResult, ProjectEntry, ProjectsSnapshot } from '../types'
import { projectDisplayNames } from '../project-display-names'
import { runCli } from './cli'
import { config, persist } from './config-store'
import { allowDirListing, allowPath, canonicalPath, readDir, resolveUserPath, statPath } from './shell'

/**
 * 桌面形態下「目前是哪個專案」的單一持有處：執行期狀態，不是每次重算——
 * 切換是一個明確動作，所有讀取都跟著它走。
 *
 * 啟動優先序：設定檔的最後啟用專案 > 無目標專案。web 形態排在它前面的
 * 環境變數與「目前工作目錄是 openspec 專案」兩項，桌面外殼沒有對應的通道
 * 可問（GUI 啟動也沒有有意義的工作目錄），因此不參與。
 * 最後啟用的專案若已不在持久化清單中，以「暫時項」存在，絕不寫回設定檔。
 */

interface ProjectState {
  current: string | null
  temporary: boolean
}

/** 並行取數的上限：清單通常個位數，開太寬只是同時壓 N 個 openspec 行程 */
const BADGE_CONCURRENCY = 4

/** 過渡同步的等待上限：本地 API server 卡住不回時，側欄的忙碌態不能跟著卡住 */
const SYNC_TIMEOUT_MS = 2_000

let statePromise: Promise<ProjectState> | null = null

function state(): Promise<ProjectState> {
  statePromise ??= initState()
  return statePromise
}

async function initState(): Promise<ProjectState> {
  const current = await config()
  if (current.lastActivePath) {
    return {
      current: current.lastActivePath,
      temporary: !current.projects.includes(current.lastActivePath),
    }
  }
  return { current: null, temporary: false }
}

export async function currentProjectPath(): Promise<string | null> {
  return (await state()).current
}

/**
 * 已放行過的 canonical 路徑。fs scope 只能加不能減，同一個路徑再放行一次不會有
 * 別的結果，只是每次讀取都白跑一趟通道。
 */
const granted = new Set<string>()

async function ensureAccess(path: string): Promise<void> {
  if (granted.has(path))
    return
  await allowPath(path)
  granted.add(path)
}

/**
 * 讀取面共用的目標專案解析：canonical 化 → 取得檔案存取授權 → 確認是既存資料夾。
 *
 * 授權排在驗證之前是因為驗證本身要讀得到那個路徑；canonical 化排在最前面是因為
 * 授權與驗證都該落在實際位置上，引擎回報的 root 也是實際位置。
 *
 * 三件事任一不成立，回傳與 web 形態同形狀的 target-missing probe 骨架
 * （server/utils/openspec-cli.ts 的 resolveTargetDir），交給同一份 normalize 分類。
 * 授權失敗與資料夾不存在落在同一類：使用者的處置一樣——換一個專案，或重新加入。
 */
export async function resolveTarget(): Promise<
  { ok: true, targetPath: string } | { ok: false, probe: ChangeListProbe }
> {
  const requested = await currentProjectPath()
  if (!requested)
    return { ok: false, probe: targetMissing('', 'No project is selected.') }

  const notAFolder = `${requested} is not an existing folder.`

  let targetPath: string
  try {
    targetPath = await canonicalPath(requested)
  }
  catch {
    return { ok: false, probe: targetMissing(requested, notAFolder) }
  }

  try {
    await ensureAccess(targetPath)
  }
  catch (error) {
    return { ok: false, probe: targetMissing(targetPath, noAccess(error)) }
  }

  try {
    if (!(await statPath(targetPath)).isDirectory)
      return { ok: false, probe: targetMissing(targetPath, notAFolder) }
  }
  catch {
    return { ok: false, probe: targetMissing(targetPath, notAFolder) }
  }

  return { ok: true, targetPath }
}

function targetMissing(targetPath: string, message: string): ChangeListProbe {
  return {
    targetPath,
    exitCode: null,
    stdout: '',
    stderr: '',
    failure: { kind: 'target-missing', message },
  }
}

export async function listProjects(): Promise<ProjectActionResult> {
  return { ok: true, snapshot: await buildSnapshot({ badges: true }) }
}

export async function addProject(input: string): Promise<ProjectActionResult> {
  const raw = input.trim()
  if (!raw)
    return { ok: false, message: 'Enter a project folder path.' }

  const expanded = await resolveUserPath(raw)
  // 寫進設定的是解開 symlink 後的實際位置，與瀏覽器那一側（realpath）對齊：
  // 兩形態才會對同一個專案得出同一個目標，側欄也才顯示同一個名字。
  // 解不開＝那個路徑不存在，與下一關的「不是資料夾」同一句話。
  let resolved: string
  try {
    resolved = await canonicalPath(expanded)
  }
  catch {
    return { ok: false, message: 'That path is not an existing folder.' }
  }

  // 授權分兩步：驗證得讀到目錄，但驗不過的路徑不該留著整個資料夾的放行，
  // 而 fs scope 只能加不能減。先給最小的單一路徑放行，通過了才放行整棵。
  let listable: boolean
  try {
    listable = await allowDirListing(resolved)
  }
  catch (error) {
    return { ok: false, message: noAccess(error) }
  }
  if (!listable)
    return { ok: false, message: 'That path is not an existing folder.' }

  const folder = await inspect(resolved)
  if (!folder.exists)
    return { ok: false, message: 'Could not read that folder. Check its permissions.' }
  if (!folder.hasOpenSpec)
    return { ok: false, message: 'That folder has no openspec/ directory.' }

  try {
    await ensureAccess(resolved)
  }
  catch (error) {
    return { ok: false, message: noAccess(error) }
  }

  const current = await config()
  const alreadyExisted = current.projects.includes(resolved)
  if (!alreadyExisted)
    current.projects = [...current.projects, resolved]
  current.lastActivePath = resolved

  const live = await state()
  live.current = resolved
  live.temporary = false
  await persist()
  await syncLocalServer(live.current)

  return { ok: true, snapshot: await buildSnapshot({ badges: false }), alreadyExisted }
}

export async function removeProject(input: string): Promise<ProjectActionResult> {
  const current = await config()
  const live = await state()
  const target = await resolveKnownPath(input, current.projects, live.current)

  current.projects = current.projects.filter(each => each !== target)
  if (live.current === target) {
    live.current = current.projects[0] ?? null
    live.temporary = false
    current.lastActivePath = live.current
  }
  await persist()
  await syncLocalServer(live.current)

  return { ok: true, snapshot: await buildSnapshot({ badges: false }) }
}

export async function switchProject(input: string): Promise<ProjectActionResult> {
  const current = await config()
  const live = await state()
  const target = await resolveKnownPath(input, current.projects, live.current)

  const persisted = current.projects.includes(target)
  if (!persisted && !(live.temporary && live.current === target))
    return { ok: false, message: 'That project is not in the list.' }

  live.current = target
  live.temporary = !persisted
  // 暫時項不寫回最後啟用專案——它不該汙染下次啟動的優先序
  if (persisted)
    current.lastActivePath = target
  await persist()
  await syncLocalServer(live.current)

  return { ok: true, snapshot: await buildSnapshot({ badges: false }) }
}

/**
 * 過渡程式：change 清單與詳情等讀取面仍由本地 API server 服務，而它在自己的
 * 記憶體裡另有一份「目前是哪個專案」。切換／加入／移除後補打它既有的切換掛載點，
 * 那一趟順帶把檔案變動監看換掛到新專案。
 *
 * 等它回來再回報成功，主區的清單重載才會落在新專案上；失敗不讓操作失敗——
 * 只是這一次主區清單會落後，再切一次即可對齊。
 *
 * 設定檔的寫入權整趟都留在這一側：`skipConfigWrite` 讓那個掛載點只更新它自己的
 * 執行期狀態。它手上那份設定是啟動時讀進去的，讓它整檔寫回會把桌面端剛寫的
 * CLI 路徑與專案清單蓋成舊值。
 *
 * TODO(debt): 桌面形態的「目前專案」目前有兩份執行期狀態（桌面端一份、本地 API
 * server 記憶體一份），只是寫入權在桌面端。上限：撐到檔案變動通知仍掛在本地 API
 * server 的過渡期，且只在開發通路有效（打包形態沒有 server，這趟一定失敗）；另有一個
 * 表達不出來的情形——移除清單裡最後一個專案時，切換掛載點需要一個路徑，講不出
 * 「沒有目標專案」，那一次 server 會停在剛被移除的專案（側欄變空清單引導、主區
 * 仍列著它的 changes）。升級條件：本地 API server 不再需要知道目前專案是哪個
 * ——那時整個函式與三處呼叫一併刪除。
 *
 * 讀取面與檔案操作面都搬進桌面形態之後它仍留著，因為檔案變動通知（即時刷新）還掛在
 * 本地 API server：那條訂閱得靠這一趟，才會監看跟畫面同一個目標專案。
 */
async function syncLocalServer(path: string | null): Promise<void> {
  if (!path)
    return

  try {
    await fetch('/api/project/switch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, skipConfigWrite: true }),
      // AbortSignal.timeout 是平台內建的逾時訊號：呼叫端是 await 的，沒有上限就一直等
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    })
  }
  catch {
    // server 沒在跑、逾時或呼叫失敗：這一次主區清單落後，本次操作照樣成立
  }
}

/** 授權失敗與「這不是一個專案資料夾」是兩回事，錯誤訊息不能指向錯的原因 */
function noAccess(error: unknown): string {
  return `Could not get access to that folder: ${error instanceof Error ? error.message : String(error)}`
}

/**
 * 側欄清單的組裝：持久化清單原序（暫時項置頂）＋顯示名消歧＋徽章數。
 *
 * 徽章是每項一趟 CLI，所以是可選的：清單端點帶，切換／加入／移除不帶
 * ——那些操作的關鍵路徑不該被 N 趟 CLI 拖住。
 */
async function buildSnapshot(options: { badges: boolean }): Promise<ProjectsSnapshot> {
  const current = await config()
  const live = await state()

  const entries = current.projects.map(each => ({
    path: each,
    current: each === live.current,
    temporary: false,
  }))
  if (live.current && live.temporary)
    entries.unshift({ path: live.current, current: true, temporary: true })

  const paths = entries.map(entry => entry.path)
  const names = projectDisplayNames(paths)
  const badges = options.badges ? await countAll(paths) : null

  const projects: ProjectEntry[] = entries.map((entry, index) => ({
    path: entry.path,
    name: names[index]!,
    current: entry.current,
    temporary: entry.temporary,
    badge: badges?.[index] ?? null,
  }))

  return { projects, currentPath: live.current, badgesIncluded: options.badges }
}

/**
 * 清單裡的路徑已是正規化過的；但資料夾若已被搬走仍要比對得到自己那一項
 * （失效專案仍要可切換、可移除），所以先原字串比對，比不到才正規化。
 */
async function resolveKnownPath(input: string, projects: string[], current: string | null): Promise<string> {
  const raw = input.trim()
  if (projects.includes(raw) || current === raw)
    return raw
  return resolveUserPath(raw)
}

async function inspect(dir: string): Promise<{ exists: boolean, hasOpenSpec: boolean }> {
  try {
    const entries = await readDir(dir)
    const openspec = entries.find(entry => entry.name === 'openspec')
    return { exists: true, hasOpenSpec: Boolean(openspec && (openspec.isDirectory || openspec.isSymlink)) }
  }
  catch {
    return { exists: false, hasOpenSpec: false }
  }
}

async function countAll(paths: string[]): Promise<Array<number | null>> {
  const counts = Array.from<number | null>({ length: paths.length }).fill(null)
  let cursor = 0

  const workers = Array.from(
    { length: Math.min(BADGE_CONCURRENCY, paths.length) },
    async () => {
      while (cursor < paths.length) {
        const index = cursor++
        counts[index] = await countActiveChanges(paths[index]!)
      }
    },
  )
  await Promise.all(workers)

  return counts
}

/** 徽章只要「數得出來或數不出來」：runCli 的分類在這裡收束回一個是非題 */
async function countActiveChanges(dir: string): Promise<number | null> {
  const outcome = await runCli(['list', '--json'], dir)
  if (!outcome.ok || outcome.exitCode !== 0)
    return null

  try {
    const parsed = JSON.parse(outcome.stdout) as {
      changes?: unknown
      root?: { source?: unknown } | null
    }
    // CLI 在非 openspec 目錄會以 cwd 造一個 implicit root：那是「沒有專案」不是「零個 change」
    if (parsed.root?.source === 'implicit')
      return null
    return Array.isArray(parsed.changes) ? parsed.changes.length : null
  }
  catch {
    return null
  }
}
