/**
 * 「openspec 低於 1.14」的唯一判斷點：archived 清單與更新檢查共用。
 *
 * 做法是辨認舊版 CLI 對新指令／新選項的拒絕訊息，不比對版本號——
 * 1.14 以前沒有 `list --archived` 與 `version --check`，commander 會以 exit 非 0
 * 回 `unknown option` ／`unknown command`。辨識不到就當作不是版本問題，
 * 呼叫端自然落入「呼叫或解析失敗」，仍有錯誤說明。
 */

import type { ChangeListProbe } from './types'
import { stripAnsi } from './normalize'

/** 本專案用到的 1.14 新增項目：`list --archived`、`version --check` */
const TOO_OLD_PATTERN = /unknown (?:option '--(?:archived|check)'|command 'version')/i

export function isCliTooOld(probe: Pick<ChangeListProbe, 'exitCode' | 'stderr' | 'failure'>): boolean {
  if (probe.failure || probe.exitCode === null || probe.exitCode === 0)
    return false
  return TOO_OLD_PATTERN.test(stripAnsi(probe.stderr))
}
