import type { OpenUrlOutcome, RevealOutcome } from '../types'
import { openInFileManager, openUrl as openUrlShell } from './shell'

/**
 * 桌面形態的「開啟檔案所在位置」與「開啟外部網址」，同住一個檔——兩條路共用
 * 同一個外掛（opener），屬同一個領域（design D8）。都只做外殼結果到商業結果
 * 的映射，不含任何平台分支：桌面形態的能力判定固定為可用，不會答「這個平台
 * 辦不到」（design D7）。
 *
 * `revealPath` 的路徑來源必須是診斷值，不得來自 artifact 內容。外殼
 * `open_in_file_manager` 收到路徑後自己判定是檔案還是資料夾（`open-project-
 * folder-directly` design D1）：是一般資料夾就直接開起來，其餘（含檔案，以及
 * macOS 的應用程式包——`open` 對一個 `.app` 路徑做的事就是啟動它）才請
 * Finder／檔案總管選取到它。前者會把路徑交給作業系統開啟，比原本「只
 * 請選取，不給讀取權」多了一條真的會執行的路——路徑不是使用者自己選的，而
 * 是這裡把關傳進去的，所以呼叫端自律這件事比以前更要緊。型別判定與開啟之間
 * 有一段極短的空窗（`metadata()` 之後、真正開啟之前，同一路徑理論上可被換
 * 掉），design D1 已記下這個取捨；此檔案不設額外防呆，唯一的把關只有呼叫端
 * 交出去的路徑本身可信。
 */

export async function revealPath(path: string): Promise<RevealOutcome> {
  const result = await openInFileManager(path)
  return result.ok ? { status: 'revealed' } : { status: 'failed' }
}

export async function openUrl(url: string): Promise<OpenUrlOutcome> {
  const result = await openUrlShell(url)
  return result.ok ? { status: 'opened' } : { status: 'failed' }
}
