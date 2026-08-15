import type { ParkUnavailableReason } from '../../src/api/types'
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

/**
 * parked change 的儲存層（design D1／D2）：一切都在 `<repo>/.git/specrun-app/` 底下。
 *
 * `.git/` 內部天然不被 git 追蹤——無污染免驗證、隨 repo 搬移、repo 刪掉就一起消失。
 * 兩條紀律：**目錄為準**（清單只認 `parked/` 底下實際存在的目錄，孤兒 metadata 自然被忽略）、
 * metadata 讀壞不 crash（一律降級成空表，parkedAt 顯示未知）。
 *
 * 獨立成純模組（不依賴 Nitro auto-import），vitest 才能直接 import 測試。
 */

const APP_DIR = 'specrun-app'
const PARKED_DIR = 'parked'
const METADATA_FILE = 'parked.json'

export type GitDirOutcome
  = { ok: true, gitDir: string }
    | { ok: false, reason: ParkUnavailableReason }

/**
 * 檢測規則從嚴（design 風險欄）：`.git` 必須是目錄才算可 park。
 * `.git` 是檔案＝worktree／submodule 的 gitdir 指標，一律禁用而不是解析後改存他處
 * ——寧可少功能，不可把 change 搬到使用者沒預期的位置。
 */
export async function resolveGitDir(projectPath: string): Promise<GitDirOutcome> {
  const gitDir = path.join(projectPath, '.git')
  try {
    const info = await stat(gitDir)
    return info.isDirectory() ? { ok: true, gitDir } : { ok: false, reason: 'git-worktree' }
  }
  catch {
    return { ok: false, reason: 'not-git-repo' }
  }
}

/** parked change 的存放根目錄；帶 name 時直接給該 change 的目錄 */
export function parkedDirOf(gitDir: string, name?: string): string {
  const root = path.join(gitDir, APP_DIR, PARKED_DIR)
  return name === undefined ? root : path.join(root, name)
}

export function metadataFileOf(gitDir: string): string {
  return path.join(gitDir, APP_DIR, METADATA_FILE)
}

/** park 當下記下的、搬移會破壞的資訊（design D2）；change 名為 key */
export interface ParkedRecord {
  /** ISO 字串；清單的「parked 3w ago」與排序依據 */
  parkedAt: string
  /** artifact id → change 目錄內的相對路徑，順序即 tabs 順序（parked 詳情的唯一來源） */
  artifacts: Record<string, string[]>
}

export type ParkedMetadata = Record<string, ParkedRecord>

/**
 * change 名同時是路徑片段：只收「單一路徑片段且非 . ..」的名字。
 * route 的 name 來自 URL，這是唯一擋得住 `../` 逃逸的地方。
 */
export function isSafeChangeName(name: string): boolean {
  return !!name && !name.includes('/') && !name.includes('\\') && name !== '.' && name !== '..'
}

/**
 * 逐欄位收斂（沿用 app-config 的姿態）：認不得的紀錄整筆丟掉。
 * 丟掉不等於資料不見——該 change 的目錄還在就照樣列出，只是 parkedAt 顯示未知。
 */
export function parseMetadata(raw: string | null): ParkedMetadata {
  if (!raw)
    return {}

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
    return parseMetadata(await readFile(file, 'utf8'))
  }
  catch {
    return {}
  }
}

/** 整檔原子替換（同目錄 temp + rename），與 app-config 同一套；不做鎖（單 App 單寫者） */
export async function writeMetadata(file: string, metadata: ParkedMetadata): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })

  const temp = `${file}.${process.pid}.tmp`
  try {
    await writeFile(temp, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')
    await rename(temp, file)
  }
  catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}

/**
 * parked 清單的唯一真實來源（spec「以目錄列舉為準」）：只認目錄，
 * 順手排除 `.DS_Store` 這類散落檔案。目錄不存在＝還沒 park 過任何東西，不是錯誤。
 */
export async function listParkedNames(parkedDir: string): Promise<string[]> {
  try {
    const entries = await readdir(parkedDir, { withFileTypes: true })
    return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
  }
  catch {
    return []
  }
}

export async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory()
  }
  catch {
    return false
  }
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target)
    return true
  }
  catch {
    return false
  }
}
