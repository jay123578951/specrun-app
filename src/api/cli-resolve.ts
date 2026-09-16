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

export interface ResolveDeps {
  /** 持久化的明示覆寫；有值時不進行任何偵測 */
  override: string | null
  /** 以 `--version` 判定某執行檔可用與否 */
  verify: (bin: string) => Promise<VerifyResult>
  /** 借 login shell 取絕對路徑；此環境不具備該能力時為 null（第 2 段整段跳過） */
  viaLoginShell: (() => Promise<string | null>) | null
  /** 把命令名還原成絕對路徑，供第一段命中時呈現用 */
  locate: () => Promise<string | null>
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
 * 解析本身（spawn 全部注入，才測得動降級順序）。覆寫存在時直接採用並回報其驗證結果：
 * 失效的覆寫不會偷偷退回自動偵測——那會讓使用者以為設定還生效。
 */
export async function resolveWith(deps: ResolveDeps): Promise<CliSettings> {
  if (deps.override) {
    const result = await deps.verify(deps.override)
    return result.ok
      ? { mode: 'override', bin: deps.override, version: result.version, message: null }
      : { mode: 'override', bin: deps.override, version: null, message: result.message }
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
      const viaShell = await deps.verify(found)
      if (viaShell.ok)
        return { mode: 'auto', bin: found, version: viaShell.version, message: null }
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
