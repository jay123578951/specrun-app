import type { RevealOutcome } from '../../src/api/types'
import { execFile } from 'node:child_process'
import { realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

/**
 * 診斷區「開啟所在位置」的 server 端實作：目前僅 macOS。兩條路都交給
 * `/usr/bin/open`，只是一條選取、一條開起（`open-project-folder-directly`
 * design D4）：目標是一般資料夾就 `open -- <path>` 把它本身開起來；其餘
 * （含檔案、以及 macOS 的應用程式包）維持 `open -R -- <path>`，在 Finder 中
 * 選取該項目而不開啟它——設定檔按下去不該跳出編輯器。
 *
 * 只有 `.app` 被擋下來。文件型的套件（`.rtfd`、`.xcodeproj`、`.workflow` 等）
 * 在檔案系統上也是資料夾，走的是開起那一條，`open` 會把它交給對應的程式開啟
 * （本機實測 `open -- Doc.rtfd` 會啟動 TextEdit）；已知並接受，理由記在 design
 * 的 D3 與 Risks。
 *
 * 絕對路徑的 `/usr/bin/open` 而非相對命令名：桌面形態那條路經 opener 外掛的
 * `open` crate，在 macOS 上執行的就是 `/usr/bin/open`（crate `open` 5.4.4，
 * `src/macos.rs`），兩個形態不必因 PATH 解析結果不同而分家。
 *
 * 兩條路都補上 `--` 分隔旗標與路徑：路徑若以 `-` 開頭會被 `open` 誤判成旗標。
 *
 * 能力判定在 server（比照 folder-picker 的 canPickFolder()），前端只讀 status 分流；
 * 不支援時 UI 呈現為禁用＋說明原因，不隱藏（design 風險欄）。`canReveal()` 答的是
 * 「這個平台辦不辦得到」，跟路徑指向什麼無關，不隨分岔而動。
 */

/** 能力判定在 server（平台分支），前端不寫死 */
export function canReveal(): boolean {
  return process.platform === 'darwin'
}

/**
 * 一個資料夾路徑要交給不帶 `-R` 的 `open` 開起來時，回傳它解過 symlink 之後的
 * 路徑；不該開起來（是應用程式包）或解不開時回 `null`，讓它走選取那一條——選取
 * 不執行任何東西。判定與開啟因此用的是同一次 `realpath` 的答案：兩者各解一次的
 * 話，判定看的是解過的、開啟看的是沒解的，中間被換成一個指向 `.app` 的 symlink
 * 就會啟動它。
 *
 * 應用程式包的認定只看副檔名。macOS 的 LaunchServices 只憑 `.app` 這個副檔名認定
 * 它，與包內結構無關：本機實測，一個裡面只有純文字檔、連 `Contents/` 都沒有的
 * `Foo.app` 目錄，`mdls` 仍報 `com.apple.application-bundle`；反過來，一個
 * `Contents/MacOS/` 俱全卻不以 `.app` 結尾的目錄報的是 `public.folder`，`open`
 * 只會把它當一般資料夾瀏覽。所以不看包內有沒有 `Contents/Info.plist`。比對忽略
 * 大小寫：實測 `Foo.APP` 一樣被啟動。副檔名取自解過 symlink 的路徑：實測一個
 * 指向 `Foo.app`、自己不以 `.app` 結尾的 symlink，`open` 一樣會啟動該應用程式。
 */
async function openableFolder(target: string): Promise<string | null> {
  try {
    const resolved = await realpath(target)
    return path.extname(resolved).toLowerCase() === '.app' ? null : resolved
  }
  catch {
    return null
  }
}

export async function revealPath(target: string): Promise<RevealOutcome> {
  if (!canReveal())
    return { status: 'unsupported' }
  if (!target.trim())
    return { status: 'failed' }

  let isDirectory: boolean
  try {
    isDirectory = (await stat(target)).isDirectory()
  }
  catch {
    return { status: 'failed' }
  }

  const resolved = isDirectory ? await openableFolder(target) : null
  const args = resolved ? ['--', resolved] : ['-R', '--', target]
  return new Promise((resolve) => {
    execFile('/usr/bin/open', args, { windowsHide: true }, error =>
      resolve(error ? { status: 'failed' } : { status: 'revealed' }))
  })
}
