import type { RevealOutcome } from '../../src/api/types'
import { execFile } from 'node:child_process'
import process from 'node:process'

/**
 * 診斷區「開啟所在位置」的 server 端實作：目前僅 macOS，`open -R` 在 Finder 中
 * 選取該項目（不是開啟它——設定檔按下去不該跳出編輯器）。
 *
 * 能力判定在 server（比照 folder-picker 的 canPickFolder()），前端只讀 status 分流；
 * 不支援時 UI 呈現為禁用＋說明原因，不隱藏（design 風險欄）。
 */

/** 能力判定在 server（平台分支），前端不寫死 */
export function canReveal(): boolean {
  return process.platform === 'darwin'
}

export function revealPath(target: string): Promise<RevealOutcome> {
  if (!canReveal())
    return Promise.resolve({ status: 'unsupported' })
  if (!target.trim())
    return Promise.resolve({ status: 'failed' })

  return new Promise((resolve) => {
    execFile('open', ['-R', target], { windowsHide: true }, error =>
      resolve(error ? { status: 'failed' } : { status: 'revealed' }))
  })
}
