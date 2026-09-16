/**
 * 應用程式設定檔的共用核心：欄位、內容解析、寫出格式、目錄與檔名。
 *
 * 兩種執行形態讀寫的是同一個檔案，所以「認得什麼內容、寫出什麼格式」必須由
 * 同一段程式決定；真正碰檔案的通道各自持有（web 走本機檔案系統，桌面走外殼）。
 *
 * 兩條紀律：讀壞不 crash——無法解析一律降級成空清單重建；寫入走 temp + rename
 * 的整檔原子替換，不做鎖（同一時刻只有一個持有者在寫）。
 */

export interface AppConfig {
  /** canonical 化後的專案路徑，順序即側欄顯示順序 */
  projects: string[]
  /** 最後啟用的專案；啟動優先序的第二順位 */
  lastActivePath: string | null
  /**
   * 使用者明示指定的 openspec 執行檔；null＝自動偵測。
   * 只存明示覆寫——偵測結果是機器環境的衍生物，寫回去就成了會過期的假資料。
   */
  openspecBin: string | null
}

export const APP_FOLDER = 'specrun-app'
export const CONFIG_FILE_NAME = 'config.json'

export function emptyConfig(): AppConfig {
  return { projects: [], lastActivePath: null, openspecBin: null }
}

/**
 * 逐欄位收斂：認不得的形狀一律丟掉，不讓外部改壞的資料流進執行期狀態。
 * 整份壞掉與部分欄位壞掉是同一種處理——能救幾個算幾個，其餘回預設。
 */
export function parseConfig(raw: string | null): AppConfig {
  if (!raw)
    return emptyConfig()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  }
  catch {
    return emptyConfig()
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    return emptyConfig()

  const record = parsed as Record<string, unknown>
  const projects: string[] = []
  if (Array.isArray(record.projects)) {
    for (const entry of record.projects) {
      if (typeof entry === 'string' && entry && !projects.includes(entry))
        projects.push(entry)
    }
  }

  const last = record.lastActivePath
  // 舊設定檔沒有 openspecBin 欄位——缺失與形狀不符同一種處理，回 null 即自動偵測，無需 migration
  const bin = record.openspecBin
  return {
    projects,
    lastActivePath: typeof last === 'string' && last ? last : null,
    openspecBin: typeof bin === 'string' && bin ? bin : null,
  }
}

/** 寫出格式的唯一決定處：兩形態寫出的位元組必須逐一相同，否則互相覆寫時會在 git 上抖動 */
export function serializeConfig(config: AppConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`
}

/** 貼進來的路徑常帶 `~`，展開一下比丟「找不到」有用（專案路徑與 CLI 路徑共用） */
export function expandHome(target: string, home: string): string {
  if (target === '~')
    return home
  if (target.startsWith('~/') || target.startsWith('~\\'))
    return home + target.slice(1).replace(/^[/\\]+/, separatorOf(home))
  return target
}

function separatorOf(home: string): string {
  return home.includes('\\') && !home.includes('/') ? '\\' : '/'
}
