import { stat } from 'node:fs/promises'

/**
 * toggle route 專用：change 名 → 已解析的 tasks 檔案路徑（design D1）。
 * 獨立成純模組（不依賴 Nitro auto-import）方便在 vitest 直接 import 測試快取邏輯。
 */

export type ResolveOutcome
  = { kind: 'paths', paths: string[] }
    | { kind: 'target-missing', detail?: string }
    | { kind: 'cli-error', detail: string }

export type TasksPathResolution
  = { ok: true, path: string }
    | { ok: false, kind: 'target-missing', detail?: string }
    | { ok: false, kind: 'cli-error', detail: string }
    | { ok: false, kind: 'no-single-file' }

export function createTasksPathCache() {
  const cache = new Map<string, string>()

  return {
    /**
     * 命中且檔案仍存在 → 直接回傳，不呼叫 `resolveViaCli`；
     * 未命中或檔案已不在 → 呼叫 `resolveViaCli`（重跑 CLI）重新解析。
     * 恰一筆路徑才寫入快取——多檔／零檔（唯讀分支）刻意不快取失敗結果，
     * 因為 change 隨時可能補齊 tasks 檔，快取住「查無單檔」會讓之後補齊的檔案永遠解析不到。
     */
    async resolve(changeName: string, resolveViaCli: () => Promise<ResolveOutcome>): Promise<TasksPathResolution> {
      const cached = cache.get(changeName)
      if (cached && await fileExists(cached))
        return { ok: true, path: cached }

      const outcome = await resolveViaCli()
      if (outcome.kind !== 'paths')
        return { ok: false, ...outcome }

      if (outcome.paths.length !== 1)
        return { ok: false, kind: 'no-single-file' }

      const path = outcome.paths[0]!
      cache.set(changeName, path)
      return { ok: true, path }
    },
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  }
  catch {
    return false
  }
}
