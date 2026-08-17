/**
 * proposal `## Why` 首句的機械摘錄（純函式，web 與 M4 Tauri 版共用）。
 *
 * 兩個資料源都要摘錄——active 清單走 CLI 回應後的檔案直讀，parked 走現場解析——
 * 抽取規則只能有一份，否則同一份 proposal 在兩處會顯示不同的一句話（design D2）。
 */

const WHY_HEADING = /^#{1,6}[ \t]+why[ \t]*$/i

/**
 * proposal `## Why` 的首句（到第一個句號為止），純機械抽取、不做 AI 加工
 * （docs/ui-structure-decisions.md 的卡片規格）。品質天花板就是 proposal 第一句的寫作品質。
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

  return firstSentence(stripMarkdown(paragraph.join(' ')))
}

/**
 * 中英文句號都算句末；找不到句號就整段帶回（clamp 交給 CSS）。
 * 全形標點自己就是句末，半形 `.` 得跟著空白或結尾才算——否則 `design.md`、`e.g.`
 * 這類寫法會把句子攔腰切斷。
 */
function firstSentence(text: string): string {
  const end = text.search(/[。！？]|[.!?](?:\s|$)/)
  return end === -1 ? text : text.slice(0, end + 1)
}

/** 只去掉行內語法記號，不做重排；摘錄要的是可讀的一句話，不是還原後的 Markdown */
function stripMarkdown(text: string): string {
  return text
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}
