import type { ArchivedEntryProbe, ArchivedListProbe } from '../../src/api/types'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { archiveDirOf, listArchivedDirs, openspecDirOf } from '../utils/archive-store'
import { resolveTargetDir } from '../utils/openspec-cli'
import { isDirectory } from '../utils/parked-store'

/**
 * `GET /api/archived`：archived 清單一趟回傳（design D2）。
 *
 * 目錄列舉為準，每個目錄現場讀 `tasks.md` 算進度；日期前綴拆解、排序與錯誤分類
 * 一律交給 shared normalize。單筆讀不到 tasks 只是那張卡沒有進度，不是整份清單失敗。
 * 不做快取——本地幾十筆小檔案，快取層是為不存在的規模設計。
 */

const TASKS_FILE = 'tasks.md'

export default defineEventHandler(async (): Promise<ArchivedListProbe> => {
  const target = await resolveTargetDir()
  if (!target.ok) {
    return {
      targetPath: target.probe.targetPath,
      entries: [],
      failure: {
        kind: 'not-openspec-project',
        message: target.probe.failure?.message ?? 'No project is selected.',
      },
    }
  }

  // 沒有 openspec/ 就不是 openspec 專案——與 Changes／Specs 頁的分層一致，
  // 不能混進「讀取失敗」讓使用者以為重試有用
  if (!(await isDirectory(openspecDirOf(target.targetPath)))) {
    return {
      targetPath: target.targetPath,
      entries: [],
      failure: {
        kind: 'not-openspec-project',
        message: `No openspec/ directory at ${target.targetPath}.`,
      },
    }
  }

  const listing = await listArchivedDirs(archiveDirOf(target.targetPath))
  if (!listing.ok) {
    return {
      targetPath: target.targetPath,
      entries: [],
      failure: { kind: 'read-failed', message: listing.message },
    }
  }

  const entries = await Promise.all(
    listing.dirs.map(dir => readEntry(target.targetPath, dir)),
  )
  return { targetPath: target.targetPath, entries }
})

/** 讀不到就是沒有：該卡退回「無進度」，其他卡片照常（spec 單一 change 讀取失敗不拖垮清單） */
async function readEntry(projectPath: string, dir: string): Promise<ArchivedEntryProbe> {
  const file = path.join(archiveDirOf(projectPath, dir), TASKS_FILE)
  try {
    return { dir, tasks: await readFile(file, 'utf8') }
  }
  catch {
    return { dir }
  }
}
