/** 反引號片段（code）與其餘文字的交替序列，供模板以 `v-for` 渲染 */
export interface InlineCodeSegment {
  text: string
  code: boolean
}

/**
 * 把只可能含反引號行內 code 的標題拆成文字／code 片段（RoadmapSummary.title、
 * 詳情面板標題——Requirement 規劃檔清單、清單卡片內容、詳情 header）。
 * 不走 markdown-it：標題只有這一種語法，且模板端要用真正的 Vue 節點渲染
 * （非 v-html），才能沿用 UnoCSS utility 而不必另開一份 CSS。
 */
export function splitInlineCode(text: string): InlineCodeSegment[] {
  const segments: InlineCodeSegment[] = []
  let cursor = 0

  for (const match of text.matchAll(/`([^`]+)`/g)) {
    if (match.index > cursor)
      segments.push({ text: text.slice(cursor, match.index), code: false })
    segments.push({ text: match[1]!, code: true })
    cursor = match.index + match[0].length
  }
  if (cursor < text.length)
    segments.push({ text: text.slice(cursor), code: false })

  return segments
}
