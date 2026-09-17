import { pathExists } from './shell'

/**
 * 勾選寫入專用：「專案路徑＋change 名」→ 已解析的 tasks 檔案路徑。
 * 問一趟 `status --change <name> --json` 實測約一秒，逐次重問會讓連按的第二下被吃掉。
 *
 * 識別鍵含專案路徑（design D4）：桌面 App 一開一整天、切專案是常態，而
 * `add-settings-modal` 這類 change 名不同專案都會取。只以 change 名識別的話，
 * 切過去之後舊記錄還在、檔案也還在，勾選就會寫進另一個專案的檔案——寫入前的
 * 逐行比對多半擋得下來，但兩邊那一行剛好一字不差時會安靜寫錯。
 */

export type ResolveOutcome
  = { kind: 'paths', paths: string[] }
    | { kind: 'cli-error', detail: string }

export type TasksPathResolution
  = { ok: true, path: string }
    | { ok: false, kind: 'cli-error', detail: string }
    | { ok: false, kind: 'no-single-file' }

export function createTasksPathCache() {
  const known = new Map<string, string>()

  return {
    /**
     * 命中且檔案仍存在 → 直接回傳，不呼叫 `resolveViaCli`；
     * 未命中或檔案已不在 → 呼叫 `resolveViaCli`（重問一趟 CLI）重新解析。
     * 恰一筆路徑才記下來——多檔／零檔（唯讀分支）刻意不記失敗結果，因為 change
     * 隨時可能補齊 tasks 檔，記住「查無單檔」會讓之後補齊的檔案永遠解析不到。
     */
    async resolve(
      projectPath: string,
      changeName: string,
      resolveViaCli: () => Promise<ResolveOutcome>,
    ): Promise<TasksPathResolution> {
      const key = `${projectPath}\n${changeName}`

      const remembered = known.get(key)
      if (remembered && await exists(remembered))
        return { ok: true, path: remembered }

      const outcome = await resolveViaCli()
      if (outcome.kind !== 'paths')
        return { ok: false, ...outcome }

      if (outcome.paths.length !== 1)
        return { ok: false, kind: 'no-single-file' }

      const path = outcome.paths[0]!
      known.set(key, path)
      return { ok: true, path }
    },
  }
}

/** 外殼被權限清單擋下時 `exists` 會 reject；那與「檔案不在」一樣要重新解析 */
async function exists(path: string): Promise<boolean> {
  try {
    return await pathExists(path)
  }
  catch {
    return false
  }
}
