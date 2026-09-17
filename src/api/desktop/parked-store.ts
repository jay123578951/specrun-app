import type { ParkUnavailableReason } from '../types'
import type { DirEntry } from './shell'
import { join, parentDir } from './paths'
import { makeDir, readDir, readTextFile, removePath, renamePath, statPath, writeTextFile } from './shell'

/**
 * 桌面形態下 parked change 的儲存層（對應 web 形態的 server/utils/parked-store.ts）：
 * 一切都在 `<repo>/.git/specrun-app/` 底下，兩形態讀寫的是同一份東西——同一個專案
 * 先用一種形態 park、再用另一種 unpark 要接得起來，所以目錄名、檔名與 metadata
 * 格式逐項對齊。
 *
 * 兩條紀律同樣照搬：**目錄為準**（清單只認 `parked/` 底下實際存在的目錄，孤兒
 * metadata 自然被忽略）、metadata 讀壞不 crash（一律降級成空表，parkedAt 顯示未知）。
 */

const APP_DIR = 'specrun-app'
const PARKED_DIR = 'parked'
const METADATA_FILE = 'parked.json'
const GIT_ENTRY = '.git'

export type GitDirOutcome
  = { ok: true, gitDir: string }
    | { ok: false, reason: ParkUnavailableReason }

/**
 * park 可用性：列出專案資料夾、在結果裡找名為 `.git` 的那一項，看它是檔案還是資料夾
 * ——不去查 `.git` 本身（design D3）。桌面形態的檔案存取是白名單制，授權一個專案時
 * 連帶放行的是「`.git` 這個資料夾」；worktree 的 `.git` 是檔案，直接查它會因存取被拒
 * 而落進「查不到」的分支，把 worktree 誤報成非 git repo。
 *
 * 檢測規則從嚴同 web 形態：`.git` 是檔案＝worktree／submodule 的 gitdir 指標，一律
 * 禁用而不是解析後改存他處。fs plugin 的 read_dir 走 Rust `DirEntry::file_type`
 * ——它不跟隨 symlink，所以 `.git` 是 symlink 時三個旗標都不是 isFile，落在可 park 這邊。
 */
export async function resolveGitDir(projectPath: string): Promise<GitDirOutcome> {
  let entries: DirEntry[]
  try {
    entries = await readDir(projectPath)
  }
  catch {
    return { ok: false, reason: 'not-git-repo' }
  }

  const entry = entries.find(each => each.name === GIT_ENTRY)
  if (!entry)
    return { ok: false, reason: 'not-git-repo' }
  return entry.isFile
    ? { ok: false, reason: 'git-worktree' }
    : { ok: true, gitDir: join(projectPath, GIT_ENTRY) }
}

/** parked change 的存放根目錄；帶 name 時直接給該 change 的目錄 */
export function parkedDirOf(gitDir: string, name?: string): string {
  const root = join(gitDir, APP_DIR, PARKED_DIR)
  return name === undefined ? root : join(root, name)
}

export function metadataFileOf(gitDir: string): string {
  return join(gitDir, APP_DIR, METADATA_FILE)
}

/** park 當下記下的、搬移會破壞的資訊；change 名為 key */
export interface ParkedRecord {
  /** ISO 字串；清單的「parked 3w ago」與排序依據 */
  parkedAt: string
  /** artifact id → change 目錄內的相對路徑，順序即 tabs 順序（parked 詳情的唯一來源） */
  artifacts: Record<string, string[]>
}

export type ParkedMetadata = Record<string, ParkedRecord>

/**
 * change 名同時是路徑片段：只收「單一路徑片段且非 . ..」的名字。
 * 名字來自呼叫端，這是唯一擋得住 `../` 逃逸的地方。
 */
export function isSafeChangeName(name: string): boolean {
  return !!name && !name.includes('/') && !name.includes('\\') && name !== '.' && name !== '..'
}

/**
 * 逐欄位收斂（沿用 app-config 的姿態）：認不得的紀錄整筆丟掉。
 * 丟掉不等於資料不見——該 change 的目錄還在就照樣列出，只是 parkedAt 顯示未知。
 */
function parseMetadata(raw: string): ParkedMetadata {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  }
  catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    return {}

  const metadata: ParkedMetadata = {}
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    const record = value as Partial<ParkedRecord> | null
    if (!record || typeof record !== 'object' || typeof record.parkedAt !== 'string')
      continue
    metadata[name] = { parkedAt: record.parkedAt, artifacts: toArtifacts(record.artifacts) }
  }
  return metadata
}

function toArtifacts(value: unknown): Record<string, string[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return {}

  const artifacts: Record<string, string[]> = {}
  for (const [id, paths] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(paths))
      artifacts[id] = paths.filter((each): each is string => typeof each === 'string')
  }
  return artifacts
}

/** 檔案不存在、讀不到、內容壞掉對呼叫端是同一件事：目前沒有可用的 metadata */
export async function readMetadata(file: string): Promise<ParkedMetadata> {
  try {
    return parseMetadata(await readTextFile(file))
  }
  catch {
    return {}
  }
}

/**
 * 整檔原子替換（同目錄 temp + rename），與設定檔同一套；不做鎖（單 App 單寫者）。
 * 暫存檔名用時間戳加亂數（design D6）：web 形態用的行程編號在 webview 裡問不到，
 * 而它的作用只是讓重疊的兩次寫入不撞同一個暫存路徑。
 */
export async function writeMetadata(file: string, metadata: ParkedMetadata): Promise<void> {
  await makeDir(parentDir(file))

  const temp = `${file}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}.tmp`
  try {
    await writeTextFile(temp, `${JSON.stringify(metadata, null, 2)}\n`)
    await renamePath(temp, file)
  }
  catch (error) {
    await removePath(temp).catch(() => {})
    throw error
  }
}

/**
 * parked 清單的唯一真實來源（spec「以目錄列舉為準」）：只認目錄，順手排除
 * `.DS_Store` 這類散落檔案。目錄不存在＝還沒 park 過任何東西，不是錯誤。
 */
export async function listParkedNames(parkedDir: string): Promise<string[]> {
  try {
    const entries = await readDir(parkedDir)
    return entries.filter(entry => entry.isDirectory).map(entry => entry.name).sort()
  }
  catch {
    return []
  }
}

/** 搬移的來源與 parked 詳情的目標都要先確認「它是一個目錄」；讀不到一律視同不是 */
export async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await statPath(target)).isDirectory
  }
  catch {
    return false
  }
}
