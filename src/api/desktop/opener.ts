import type { OpenUrlOutcome, RevealOutcome } from '../types'
import { openUrl as openUrlShell, revealItemInDir } from './shell'

/**
 * 桌面形態的「開啟檔案所在位置」與「開啟外部網址」，同住一個檔——兩條路共用
 * 同一個外掛（opener），屬同一個領域（design D8）。都只做外殼結果到商業結果
 * 的映射，不含任何平台分支：桌面形態的能力判定固定為可用，不會答「這個平台
 * 辦不到」（design D7）。
 *
 * `revealPath` 的路徑來源必須是診斷值，不得來自 artifact 內容——`opener` 外掛的
 * `reveal_item_in_dir` 指令完全沒有 scope 概念（`allow-reveal-item-in-dir` 的權限
 * 描述原文是「without any pre-configured scope」，design D5 已查證），不受
 * `fs:scope` 限制，也沒有 runtime `allow_path` 這道關卡，唯一的把關只有呼叫端
 * 自律。它不給讀取權，只請 Finder／檔案總管選取到一個絕對路徑，所以不影響
 * design D5 的結論；但呼叫端把關這件事本身沒有防呆，改動這個檔案時要留意。
 */

export async function revealPath(path: string): Promise<RevealOutcome> {
  const result = await revealItemInDir(path)
  return result.ok ? { status: 'revealed' } : { status: 'failed' }
}

export async function openUrl(url: string): Promise<OpenUrlOutcome> {
  const result = await openUrlShell(url)
  return result.ok ? { status: 'opened' } : { status: 'failed' }
}
