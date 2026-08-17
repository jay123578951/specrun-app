import type { PickFolderOutcome } from '../../src/api/types'
import { execFile } from 'node:child_process'
import process from 'node:process'

/**
 * 原生資料夾選擇 dialog 的 server 端實作（design D2）：目前僅 macOS，透過
 * osascript 開 `choose folder`。結果映射抽成純函式（design D3），spawn 不參與測試。
 * 路徑驗證不在這裡——選出的路徑一律走 `POST /api/projects` 的既有驗證。
 */

const PROMPT = 'Select a project folder'

/** dialog 開著時再收到請求就回 busy，不疊開第二個；旗標隨 osascript 結束釋放 */
let inFlight = false

export interface OsascriptResult {
  /** process 的 exit code；spawn 未成立時為 null */
  exitCode: number | null
  stdout: string
  stderr: string
}

/** 能力判定在 server（平台分支），前端不寫死 */
export function canPickFolder(): boolean {
  return process.platform === 'darwin'
}

export function mapOsascriptResult(result: OsascriptResult): PickFolderOutcome {
  if (result.exitCode === 0) {
    // `POSIX path of` 的輸出尾端帶換行；資料夾名可能以空白結尾，所以只修尾端換行
    const picked = result.stdout.replace(/[\r\n]+$/, '')
    return picked ? { status: 'picked', path: picked } : { status: 'failed' }
  }

  // 取消的判定以 exit 非 0＋stderr 關鍵字寬鬆比對；比對不中最壞落入 failed → 展開輸入列
  if (/user canceled/i.test(result.stderr))
    return { status: 'canceled' }

  return { status: 'failed' }
}

export async function pickFolder(): Promise<PickFolderOutcome> {
  if (!canPickFolder())
    return { status: 'unsupported' }
  if (inFlight)
    return { status: 'busy' }

  inFlight = true
  try {
    return mapOsascriptResult(await runOsascript())
  }
  finally {
    inFlight = false
  }
}

/**
 * 不設 timeout：使用者想選多久就選多久，本機請求掛著沒有資源疑慮。
 * `tell me to activate` 讓 osascript 自身（dialog 的宿主）到前景，不經 System Events，
 * 因此不觸發 macOS 自動化權限（TCC）授權彈窗。
 */
function runOsascript(): Promise<OsascriptResult> {
  return new Promise((resolve) => {
    execFile(
      'osascript',
      [
        '-e',
        'tell me to activate',
        '-e',
        `POSIX path of (choose folder with prompt "${PROMPT}")`,
      ],
      { windowsHide: true },
      (error, stdout, stderr) => {
        resolve({
          exitCode: error ? (typeof error.code === 'number' ? error.code : null) : 0,
          stdout,
          stderr,
        })
      },
    )
  })
}
