/**
 * CLI 原始輸出 → App 型別的唯一轉換點（純函式，web 與 M4 Tauri 版共用）。
 *
 * 判定順序刻意固定：spawn 層失敗 → 輸出可否解析 → exit code → root 是否為目標專案 → 逐筆欄位。
 * 每一關都往前收斂，後面的分支才能假設前面成立。
 */

import type {
  ArtifactFile,
  ArtifactView,
  ChangeDetailProbe,
  ChangeDetailResult,
  ChangeListProbe,
  ChangeListResult,
  ChangeStatus,
  ChangeSummary,
  GatewayErrorKind,
  SpecContentProbe,
  SpecContentResult,
  SpecListProbe,
  SpecListResult,
  SpecSummary,
} from './types'

const CHANGE_STATUSES: ChangeStatus[] = ['no-tasks', 'in-progress', 'complete']

/** CLI 失敗時 stdout 上的診斷條目（`{ changes: [], root: null, status: [...] }`） */
interface CliDiagnostic {
  code: string
  message: string
  fix?: string
  target?: string
}

export function normalizeChangeList(probe: ChangeListProbe): ChangeListResult {
  const fail = (kind: GatewayErrorKind, message: string, detail?: string): ChangeListResult => ({
    ok: false,
    targetPath: probe.targetPath,
    error: detail ? { kind, message, detail } : { kind, message },
  })

  if (probe.failure) {
    switch (probe.failure.kind) {
      case 'cli-unavailable':
        return fail('cli-unavailable', 'The openspec CLI is not available.', probe.failure.message)
      // 路徑不存在的資料夾當然不是 openspec 專案；與 CLI 找不到執行檔分開才不會誤導使用者
      case 'target-missing':
        return fail('not-openspec-project', 'The target folder is not an OpenSpec project.', probe.failure.message)
      default:
        return fail('call-failed', 'Could not read the change list.', probe.failure.message)
    }
  }

  const payload = parseJson(probe.stdout)
  if (!payload)
    return fail('call-failed', 'Could not read the change list.', describeUnparsable(probe))

  if (probe.exitCode !== 0) {
    const diagnostic = firstDiagnostic(payload)
    // exit 非 0＋root 解析類診斷 payload＝目標路徑無 openspec root（design D3）
    if (diagnostic && isRootDiagnostic(diagnostic)) {
      return fail(
        'not-openspec-project',
        'The target folder is not an OpenSpec project.',
        joinDetail(diagnostic.message, diagnostic.fix),
      )
    }
    return fail(
      'call-failed',
      'Could not read the change list.',
      diagnostic ? joinDetail(diagnostic.message, diagnostic.fix) : `openspec exited with code ${probe.exitCode}.`,
    )
  }

  const root = checkRoot(payload, probe.targetPath)
  if (!root.ok) {
    return root.kind === 'missing'
      ? fail('call-failed', 'Could not read the change list.', 'The CLI response carried no root path.')
      : fail('not-openspec-project', 'The target folder is not an OpenSpec project.', root.detail)
  }

  if (!Array.isArray(payload.changes))
    return fail('call-failed', 'Could not read the change list.', 'The CLI response carried no change list.')

  const changes: ChangeSummary[] = []
  for (const raw of payload.changes) {
    const change = toSummary(raw)
    if (!change)
      return fail('call-failed', 'Could not read the change list.', 'The CLI response had an unexpected shape.')
    changes.push(change)
  }

  // 順序即 CLI 順序（lastModified 新→舊）；前端不重排（spec openspec-gateway）
  return { ok: true, targetPath: probe.targetPath, changes }
}

/**
 * 詳情的判定順序與清單同構：spawn 層失敗 → 可否解析 → exit code → 組裝 artifact。
 *
 * root 是否為目標專案不在這裡重判——詳情只從成功的清單點進來，那一關清單已把過；
 * 真出現 root 類診斷（點開瞬間專案被搬走）會落在 exit code 那關，一樣分類得出來。
 */
export function normalizeChangeDetail(probe: ChangeDetailProbe): ChangeDetailResult {
  const fail = (kind: GatewayErrorKind, message: string, detail?: string): ChangeDetailResult => ({
    ok: false,
    error: detail ? { kind, message, detail } : { kind, message },
  })
  const failLoad = (detail?: string): ChangeDetailResult =>
    fail('call-failed', 'Could not load this change.', detail)

  if (probe.failure) {
    switch (probe.failure.kind) {
      case 'cli-unavailable':
        return fail('cli-unavailable', 'The openspec CLI is not available.', probe.failure.message)
      case 'target-missing':
        return fail('not-openspec-project', 'The target folder is not an OpenSpec project.', probe.failure.message)
      default:
        return failLoad(probe.failure.message)
    }
  }

  const payload = parseJson(probe.stdout)
  if (!payload)
    return failLoad(describeUnparsable(probe))

  if (probe.exitCode !== 0) {
    const diagnostic = firstDiagnostic(payload)
    if (diagnostic && isRootDiagnostic(diagnostic))
      return fail('not-openspec-project', 'The target folder is not an OpenSpec project.', joinDetail(diagnostic.message, diagnostic.fix))
    // change 不存在（已被 archive／刪除）走這裡：CLI 的 change_error 診斷歸「呼叫或解析失敗」
    return failLoad(
      diagnostic ? joinDetail(diagnostic.message, diagnostic.fix) : `openspec exited with code ${probe.exitCode}.`,
    )
  }

  const name = typeof payload.changeName === 'string' && payload.changeName
    ? payload.changeName
    : probe.changeName
  if (!name)
    return failLoad('The CLI response carried no change name.')

  const changeRoot = typeof payload.changeRoot === 'string' ? payload.changeRoot : ''
  const ids = artifactIds(payload)
  if (!ids)
    return failLoad('The CLI response carried no artifact list.')

  const artifacts: ArtifactView[] = []
  for (const id of ids) {
    const files: ArtifactFile[] = []
    for (const entry of probe.files?.[id] ?? []) {
      // 白名單內的檔案讀不到＝真失敗，不是缺件（spec openspec-gateway）
      if (typeof entry.content !== 'string')
        return failLoad(joinDetail(`Could not read ${entry.path}.`, entry.error))
      files.push({ path: displayPath(entry.path, changeRoot), content: entry.content })
    }
    artifacts.push({ id, files, missing: files.length === 0 })
  }

  return { ok: true, detail: { name, artifacts } }
}

/**
 * specs 清單的判定順序與 change 清單同構——同一個 `list` 家族的 `--json` 輸出，
 * 差別只在讀 `payload.specs` 而非 `payload.changes`。
 */
export function normalizeSpecList(probe: SpecListProbe): SpecListResult {
  const fail = (kind: GatewayErrorKind, message: string, detail?: string): SpecListResult => ({
    ok: false,
    targetPath: probe.targetPath,
    error: detail ? { kind, message, detail } : { kind, message },
  })
  const failLoad = (detail?: string): SpecListResult =>
    fail('call-failed', 'Could not read the spec list.', detail)

  if (probe.failure) {
    switch (probe.failure.kind) {
      case 'cli-unavailable':
        return fail('cli-unavailable', 'The openspec CLI is not available.', probe.failure.message)
      case 'target-missing':
        return fail('not-openspec-project', 'The target folder is not an OpenSpec project.', probe.failure.message)
      default:
        return failLoad(probe.failure.message)
    }
  }

  const payload = parseJson(probe.stdout)
  if (!payload)
    return failLoad(describeUnparsable(probe))

  if (probe.exitCode !== 0) {
    const diagnostic = firstDiagnostic(payload)
    if (diagnostic && isRootDiagnostic(diagnostic))
      return fail('not-openspec-project', 'The target folder is not an OpenSpec project.', joinDetail(diagnostic.message, diagnostic.fix))
    return failLoad(
      diagnostic ? joinDetail(diagnostic.message, diagnostic.fix) : `openspec exited with code ${probe.exitCode}.`,
    )
  }

  const root = checkRoot(payload, probe.targetPath)
  if (!root.ok) {
    return root.kind === 'missing'
      ? failLoad('The CLI response carried no root path.')
      : fail('not-openspec-project', 'The target folder is not an OpenSpec project.', root.detail)
  }

  if (!Array.isArray(payload.specs))
    return failLoad('The CLI response carried no spec list.')

  const specs: SpecSummary[] = []
  for (const raw of payload.specs) {
    const spec = toSpecSummary(raw)
    if (!spec)
      return failLoad('The CLI response had an unexpected shape.')
    specs.push(spec)
  }

  // 順序即 CLI 順序；前端不重排（spec openspec-gateway）
  return { ok: true, targetPath: probe.targetPath, specs }
}

/**
 * spec 全文：stdout 不是 JSON 而是 Markdown 原文，所以這裡只判「這趟呼叫成不成立」，
 * 內容一個字都不動（spec openspec-gateway「原樣轉交」）。
 * 空 stdout 一律當失敗——CLI 找不到 spec 時就是非 0＋空輸出，不能偽裝成一份空 spec。
 */
export function normalizeSpecContent(probe: SpecContentProbe): SpecContentResult {
  const fail = (kind: GatewayErrorKind, detail?: string): SpecContentResult => ({
    ok: false,
    error: {
      kind,
      message: kind === 'cli-unavailable'
        ? 'The openspec CLI is not available.'
        : 'Could not load this spec.',
      ...(detail ? { detail } : {}),
    },
  })

  if (probe.failure) {
    return probe.failure.kind === 'cli-unavailable'
      ? fail('cli-unavailable', probe.failure.message)
      : fail('call-failed', probe.failure.message)
  }

  if (probe.exitCode !== 0)
    return fail('call-failed', firstLine(probe.stderr) || `openspec exited with code ${probe.exitCode}.`)

  if (!probe.stdout.trim())
    return fail('call-failed', `openspec returned no content for ${probe.specId}.`)

  return { ok: true, id: probe.specId, content: probe.stdout }
}

/**
 * CLI 回報的 root 是否就是目標專案（design D3）。判準是 `root.path` 比對；`source`
 * 的 `implicit` 只是補強訊號——CLI 找不到任何 openspec root 時會以 cwd 造一個，
 * 此時路徑會「相符」但專案並不存在。
 */
type RootVerdict
  = { ok: true }
    | { ok: false, kind: 'missing' }
    | { ok: false, kind: 'not-project', detail: string }

function checkRoot(payload: Record<string, unknown>, targetPath: string): RootVerdict {
  const root = asRecord(payload.root)
  const rootPath = typeof root?.path === 'string' ? root.path : null
  if (!rootPath)
    return { ok: false, kind: 'missing' }

  if (!samePath(rootPath, targetPath))
    return { ok: false, kind: 'not-project', detail: `openspec resolved its root to ${rootPath} instead.` }

  if (root?.source === 'implicit')
    return { ok: false, kind: 'not-project', detail: 'No openspec/ directory was found in this folder or its parents.' }

  return { ok: true }
}

function toSpecSummary(raw: unknown): SpecSummary | null {
  const item = asRecord(raw)
  if (!item)
    return null

  const { id, requirementCount } = item
  if (typeof id !== 'string' || !id)
    return null
  if (!Number.isFinite(requirementCount))
    return null

  return { id, requirementCount: requirementCount as number }
}

/** tabs 的內容與順序沿用 CLI；`artifacts` 陣列是權威順序，缺了才退回 artifactPaths 的鍵序 */
function artifactIds(payload: Record<string, unknown>): string[] | null {
  if (Array.isArray(payload.artifacts)) {
    const ids: string[] = []
    for (const raw of payload.artifacts) {
      const id = asRecord(raw)?.id
      if (typeof id !== 'string' || !id)
        return null
      ids.push(id)
    }
    return ids
  }
  const paths = asRecord(payload.artifactPaths)
  return paths ? Object.keys(paths) : null
}

/** 絕對路徑對使用者無資訊量；specs 多檔標頭只需 change 目錄內的相對位置 */
function displayPath(absolute: string, changeRoot: string): string {
  const prefix = trimTrailingSlash(changeRoot)
  if (prefix && absolute.startsWith(prefix))
    return absolute.slice(prefix.length).replace(/^[/\\]+/, '') || absolute
  return absolute
}

function parseJson(stdout: string): Record<string, unknown> | null {
  try {
    return asRecord(JSON.parse(stdout))
  }
  catch {
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function toSummary(raw: unknown): ChangeSummary | null {
  const item = asRecord(raw)
  if (!item)
    return null

  const { name, completedTasks, totalTasks, status } = item
  if (typeof name !== 'string' || !name)
    return null
  if (!Number.isFinite(completedTasks) || !Number.isFinite(totalTasks))
    return null
  if (!CHANGE_STATUSES.includes(status as ChangeStatus))
    return null

  const lastModified = toEpochMs(item.lastModified)
  if (lastModified === null)
    return null

  return {
    name,
    completedTasks: completedTasks as number,
    totalTasks: totalTasks as number,
    status: status as ChangeStatus,
    lastModified,
  }
}

function toEpochMs(value: unknown): number | null {
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : null
  if (typeof value !== 'string')
    return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function firstDiagnostic(payload: Record<string, unknown>): CliDiagnostic | null {
  if (!Array.isArray(payload.status))
    return null
  for (const raw of payload.status) {
    const entry = asRecord(raw)
    if (typeof entry?.code === 'string' && typeof entry.message === 'string') {
      return {
        code: entry.code,
        message: entry.message,
        ...(typeof entry.fix === 'string' ? { fix: entry.fix } : {}),
        ...(typeof entry.target === 'string' ? { target: entry.target } : {}),
      }
    }
  }
  return null
}

/**
 * root 解析失敗的診斷（`no_openspec_root`、`no_root_with_registered_stores`、
 * store 家族…）→「非 openspec 專案」；其餘診斷（如 `list_error`）是引擎自身出錯，
 * 歸「呼叫或解析失敗」，免得把 CLI 內部錯誤講成「這裡沒有專案」。
 */
function isRootDiagnostic(diagnostic: CliDiagnostic): boolean {
  const haystack = `${diagnostic.code} ${diagnostic.target ?? ''}`
  return haystack.includes('root') || haystack.includes('store')
}

/** 兩邊都已 realpath 過，只需吸收尾斜線差異 */
function samePath(a: string, b: string): boolean {
  return trimTrailingSlash(a) === trimTrailingSlash(b)
}

function trimTrailingSlash(value: string): string {
  return value.length > 1 ? value.replace(/[/\\]+$/, '') : value
}

function joinDetail(...parts: (string | undefined)[]): string | undefined {
  const detail = parts.filter(Boolean).join(' ')
  return detail || undefined
}

function describeUnparsable(probe: ChangeListProbe): string | undefined {
  return joinDetail(firstLine(probe.stderr) || firstLine(probe.stdout))
}

function firstLine(value: string): string {
  return stripAnsi(value).trim().split('\n', 1)[0]?.slice(0, 200) ?? ''
}

/**
 * CLI 的 stderr 即使不接終端也會帶顏色碼（`show` 的錯誤前綴就是一例）；
 * 這些細節會原樣顯示在 UI 上，所以在唯一的出口先清掉。
 */
// eslint-disable-next-line no-control-regex -- ESC 正是這裡要匹配的字元
const ANSI = /\u001B\[[0-9;]*m/g

function stripAnsi(value: string): string {
  return value.replace(ANSI, '')
}
