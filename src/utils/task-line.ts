/**
 * task 行的「只翻勾選字元」核心（design D3／D4）。
 *
 * 伺服端寫檔與 store 的樂觀更新共用這一份：兩邊翻出來的字串必須逐 byte 相同，
 * watcher 重取回來的內容才會與快取全等，既有的「無差異不重繪」才吸收得掉。
 * 純字串運算、無 I/O——因此放在 shared 的 src/ 側，由 server route 反向 import
 * （與 normalize 同一個方向，design D1）。
 */

/**
 * 可翻轉的 task 行。判定範圍須涵蓋 markdown-it-task-lists 認得的集合：
 * `-`/`*`/`+`、有序清單（`.` 與 `)`）、縮排子項、大寫 `X`。
 * 尾端的 `[ \t]+\S` 對應 plugin 的 `content.indexOf('[x] ') === 0`——
 * 括號後沒有內容的行 plugin 不當 task，這裡也不當。一致性由 task-consistency.test.ts 鎖定。
 */
const TASK_LINE = /^([ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+\[)[ x](?=\][ \t]+\S)/i

export type ToggleFailure = 'conflict' | 'not-a-task-line'

export type LineToggle
  = { ok: true, content: string }
    | { ok: false, reason: ToggleFailure }

export function isTaskLine(text: string): boolean {
  return TASK_LINE.test(text)
}

/** 該 task 行目前是否為已勾選；非 task 行回 false */
export function isCheckedLine(text: string): boolean {
  const match = TASK_LINE.exec(text)
  return match !== null && text[match[1]!.length]!.toLowerCase() === 'x'
}

/**
 * 保留行尾符的切行：`\r\n`／`\n` 原樣留在該行尾端，
 * 拼回時 EOL 風格與「檔尾有無換行」全部保真（design D4）。
 */
export function splitLines(content: string): string[] {
  return content.split(/(?<=\n)/)
}

/** 第 `line` 行（0-based）去行尾符後的原文；行不存在回 null */
export function lineTextAt(content: string, line: number): string | null {
  const raw = splitLines(content)[line]
  return raw === undefined ? null : stripEnding(raw)
}

/**
 * 比對第 `line` 行是否仍為 `expectedText`，是則只置換該行的勾選字元後回傳整檔內容。
 * 行文比對在語法判定之前——行已被外部改寫一律回衝突，不進翻行邏輯（design D3）。
 */
export function toggleTaskLine(
  content: string,
  line: number,
  expectedText: string,
  checked: boolean,
): LineToggle {
  const lines = splitLines(content)
  const raw = lines[line]
  if (raw === undefined)
    return { ok: false, reason: 'conflict' }

  const text = stripEnding(raw)
  if (text !== expectedText)
    return { ok: false, reason: 'conflict' }

  const match = TASK_LINE.exec(text)
  if (!match)
    return { ok: false, reason: 'not-a-task-line' }

  const at = match[1]!.length
  const ending = raw.slice(text.length)
  lines[line] = `${text.slice(0, at)}${checked ? 'x' : ' '}${text.slice(at + 1)}${ending}`
  return { ok: true, content: lines.join('') }
}

function stripEnding(raw: string): string {
  return raw.replace(/\r?\n$/, '')
}
