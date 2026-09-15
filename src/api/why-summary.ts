/**
 * proposal `## Why` 第一段的機械摘錄（純函式，web 與日後的 Tauri 版共用）。
 *
 * 兩個資料源都要摘錄——active 清單走 CLI 回應後的檔案直讀，parked 走現場解析——
 * 抽取規則只能有一份，否則同一份 proposal 在兩處會顯示不同的內容。
 */

const WHY_HEADING = /^#{1,6}[ \t]+why[ \t]*$/i

/**
 * proposal `## Why` 之後第一段的全文，純機械抽取、不做 AI 加工。
 *
 * 抽取單位是「段落」而非「句」：空行是這份資料裡唯一不需啟發式判斷的邊界，
 * 判定句末則得處理縮寫、版本號、檔名等歧義，每條規則都有自己的反例。
 * 不設字元上限、也不預測顯示行數——純函式取不到卡片寬度與實際斷行，
 * 截斷點與省略號一律交由呈現層的 `line-clamp` 決定。
 */
export function extractWhy(source: string): string {
  const lines = source.split(/\r?\n/)
  const start = lines.findIndex(line => WHY_HEADING.test(line.trim()))
  if (start === -1)
    return ''

  const paragraph: string[] = []
  for (const line of lines.slice(start + 1)) {
    const text = line.trim()
    // 下一個標題＝Why 段落結束；段落已開始時空行也是結束（只要第一段）
    if (text.startsWith('#'))
      break
    if (!text) {
      if (paragraph.length)
        break
      continue
    }
    paragraph.push(text)
  }

  return stripMarkdown(paragraph.join(' '))
}

/** 只去掉行內語法記號，不做重排；摘錄要的是可讀的文字，不是還原後的 Markdown */
function stripMarkdown(text: string): string {
  return text
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}
