import { readdir } from 'node:fs/promises'
import path from 'node:path'

/**
 * archived change 的讀取層（design D1）：一切都在 `<project>/openspec/changes/archive/` 底下。
 *
 * openspec CLI 不認識 archived change（`list` 無選項、`status`／`show` 回錯誤），
 * 所以這裡走檔案層直讀——只列目錄、只讀 Markdown，不涉任何規格語意（比照 park 先例）。
 * 一條紀律：**目錄為準**，清單只認 archive 底下實際存在的目錄。
 *
 * 獨立成純模組（不依賴 Nitro auto-import），與 parked-store 同一種形狀。
 */

export function openspecDirOf(projectPath: string): string {
  return path.join(projectPath, 'openspec')
}

/** archived change 的存放根目錄；帶 dir 時直接給該 change 的目錄 */
export function archiveDirOf(projectPath: string, dir?: string): string {
  const root = path.join(openspecDirOf(projectPath), 'changes', 'archive')
  return dir === undefined ? root : path.join(root, dir)
}

export type ArchiveListing
  = { ok: true, dirs: string[] }
    | { ok: false, message: string }

/**
 * 只認目錄，順手排除 `.DS_Store` 這類散落檔案。
 * 目錄不存在＝還沒 archive 過任何 change，是空清單不是錯誤（spec 空狀態）；
 * 權限之類的真失敗才往上報，UI 才有得重試。
 */
export async function listArchivedDirs(archiveRoot: string): Promise<ArchiveListing> {
  try {
    const entries = await readdir(archiveRoot, { withFileTypes: true })
    return { ok: true, dirs: entries.filter(entry => entry.isDirectory()).map(entry => entry.name) }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT')
      return { ok: true, dirs: [] }
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}
