import type { CliSettings } from './types'

/**
 * openspec 執行檔解析的決策層：優先序與三段降級，spawn 全部注入。
 * 兩種執行形態共用同一份決策，各自只提供「怎麼跑一個指令」。
 *
 * 優先序：使用者持久化的明示覆寫 ＞ 自動偵測。自動偵測三段降級——
 * ① 直接以命令名執行，吃行程本身的 PATH（`pnpm dev` 形態第一段就命中）
 * ② 借使用者 login shell 的真實 PATH 取絕對路徑
 *    （macOS GUI App 從 Finder 啟動時 PATH 只有 /usr/bin:/bin:/usr/sbin:/sbin）
 * ③ 皆未命中則回報不可用，引導手動指定。
 *
 * MUST NOT 維護一份寫死的常見安裝位置清單——那要永久追著套件管理器生態跑，
 * 而 login shell 已一次涵蓋所有正確安裝的情況。
 */

export const CLI_COMMAND = 'openspec'

export type VerifyResult
  = { ok: true, version: string }
    | { ok: false, message: string }

/** 只帶搜尋路徑（`PATH`），不把登入 shell 的整份環境倒進子行程 */
export type ResolveEnv = Record<string, string>

/** 第②段借登入 shell 問到的執行檔位置，與問到它當下的搜尋路徑（見 design「借登入 shell 解析路徑時，把它的搜尋路徑一併帶回來」） */
export interface LoginShellHit {
  bin: string
  searchPath: string
}

export interface ResolveDeps {
  /** 持久化的明示覆寫；有值時不進行任何偵測 */
  override: string | null
  /** 以 `--version` 判定某執行檔可用與否；`env` 有值時該次執行要帶著它 */
  verify: (bin: string, env?: ResolveEnv) => Promise<VerifyResult>
  /** 借 login shell 取絕對路徑與其搜尋路徑；此環境不具備該能力時為 null（第 2 段整段跳過） */
  viaLoginShell: (() => Promise<LoginShellHit | null>) | null
  /** 把命令名還原成絕對路徑，供第一段命中時呈現用 */
  locate: () => Promise<string | null>
  /**
   * 手動指定模式驗證與後續執行所需的搜尋路徑來源。第 2 段（借登入 shell）不會
   * 在覆寫分支被呼叫，故另立這個問法——實作端同樣借登入 shell，只是只問 `PATH`、
   * 不問 openspec 的位置。此環境不具備該能力時為 null。
   */
  overrideSearchPath: (() => Promise<string | null>) | null
}

/**
 * `command -v` 的輸出可能混著 rc 檔的雜訊（互動式 shell 的 motd、版本管理器提示）；
 * 命令位置永遠是最後才印出的那一行，所以只取最後一行非空白內容。
 * 取到的路徑仍要通過 `--version` 才採用——雜訊碰巧長得像路徑也過不了那一關。
 */
export function pickCommandPath(stdout: string): string | null {
  const lines = stdout.split('\n').map(line => line.trim()).filter(Boolean)
  return lines.at(-1) ?? null
}

/** `--version` 的輸出取第一行非空白內容當版本字串 */
export function pickVersion(stdout: string): string {
  return stdout.split('\n').map(line => line.trim()).find(Boolean) ?? 'unknown version'
}

/**
 * 第②段合併問「執行檔位置」與「搜尋路徑」時用的分隔字串：兩者由同一趟登入 shell
 * 一次問出（design 決策——那趟登入 shell 的成本本來就要付），輸出以這個字串
 * 切成前後兩段，不必再另外起一趟登入 shell 專程問 `PATH`。
 */
export const LOGIN_SHELL_PATH_MARKER = '__specrun_login_shell_path__'

/**
 * 切開合併輸出：分隔字串之前套用 `pickCommandPath` 的規則（rc 雜訊同樣可能混在
 * 這一段），之後原樣 trim 當搜尋路徑。分隔字串沒出現（逾時前被截斷等）視同兩者
 * 都沒問到。
 */
export function pickCommandPathAndSearchPath(stdout: string): { bin: string | null, searchPath: string | null } {
  const markerIndex = stdout.indexOf(LOGIN_SHELL_PATH_MARKER)
  if (markerIndex === -1)
    return { bin: pickCommandPath(stdout), searchPath: null }

  const bin = pickCommandPath(stdout.slice(0, markerIndex))
  const searchPath = stdout.slice(markerIndex + LOGIN_SHELL_PATH_MARKER.length).trim() || null
  return { bin, searchPath }
}

/**
 * 解析本身（spawn 全部注入，才測得動降級順序）。覆寫存在時直接採用並回報其驗證結果：
 * 失效的覆寫不會偷偷退回自動偵測——那會讓使用者以為設定還生效。
 */
export async function resolveWith(deps: ResolveDeps): Promise<CliSettings> {
  if (deps.override) {
    const searchPath = await deps.overrideSearchPath?.() ?? null
    const env = searchPath ? { PATH: searchPath } : undefined
    const result = await deps.verify(deps.override, env)
    return result.ok
      ? { mode: 'override', bin: deps.override, version: result.version, message: null, env }
      : { mode: 'override', bin: deps.override, version: null, message: result.message, env }
  }

  const direct = await deps.verify(CLI_COMMAND)
  if (direct.ok) {
    // 命令名跑得動只證明「有」，畫面上還要看得出究竟是哪一個檔案
    // ——把它還原成絕對路徑，還原不出來才退回命令名
    const absolute = await deps.locate()
    return { mode: 'auto', bin: absolute ?? CLI_COMMAND, version: direct.version, message: null }
  }

  if (deps.viaLoginShell) {
    const found = await deps.viaLoginShell()
    if (found) {
      const env: ResolveEnv = { PATH: found.searchPath }
      const viaShell = await deps.verify(found.bin, env)
      if (viaShell.ok)
        return { mode: 'auto', bin: found.bin, version: viaShell.version, message: null, env }

      // 「找到了但執行失敗」與「兩段都沒找到」是不同的處境，不能沿用 direct.message
      // ——後者只說得出第①段沒過，看的人無從分辨究竟是路徑沒找到還是找到了跑不動。
      return {
        mode: 'auto',
        bin: null,
        version: null,
        message: `Found "${CLI_COMMAND}" via your login shell at "${found.bin}", but running it failed: ${viaShell.message}`,
      }
    }
  }

  return {
    mode: 'auto',
    bin: null,
    version: null,
    message: deps.viaLoginShell
      ? `Could not find "${CLI_COMMAND}" on PATH or through your login shell. ${direct.message}`
      : `Could not find "${CLI_COMMAND}" on PATH. ${direct.message}`,
  }
}
