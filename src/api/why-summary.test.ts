import { describe, expect, it } from 'vitest'
import { extractWhy } from './why-summary'

describe('extractWhy: proposal 第一段摘錄', () => {
  it('多句段落整段帶回，不在句號處截斷', () => {
    const proposal = '## Why\n\n第一句。第二句。\n\n第二段不要。\n\n## What Changes\n\n不相關\n'
    expect(extractWhy(proposal)).toBe('第一句。第二句。')
  })

  it('只取第一段，空行之後的段落不進摘錄', () => {
    expect(extractWhy('## Why\n\n第一段。\n\n第二段。\n'))
      .toBe('第一段。')
  })

  it('同段落跨行以單一空白接合為一行', () => {
    expect(extractWhy('## Why\n\n第一行\n第二行'))
      .toBe('第一行 第二行')
  })

  it('去掉行內 markdown 語法', () => {
    expect(extractWhy('## Why\n\n把 `code` 與 **粗體** 和 [連結](http://x) 攤平。'))
      .toBe('把 code 與 粗體 和 連結 攤平。')
  })

  it('半形句號不再是特例，`design.md` 與後續句子完整保留', () => {
    expect(extractWhy('## Why\n\n細節見 design.md 的第二節。後續說明。'))
      .toBe('細節見 design.md 的第二節。後續說明。')
    expect(extractWhy('## Why\n\nSee section 2.1 for details. Rest.'))
      .toBe('See section 2.1 for details. Rest.')
  })

  /** 句末判定移除後，縮寫誤切這個已知代價一併消失 */
  it('後接空白的英文縮寫不再提早結束', () => {
    expect(extractWhy('## Why\n\nSee e.g. the second section. Rest.'))
      .toBe('See e.g. the second section. Rest.')
  })

  it('沒有 Why 段落回空字串', () => {
    expect(extractWhy('## Context\n\n沒有 Why')).toBe('')
    expect(extractWhy('')).toBe('')
  })

  it('段落存在但內容為空同樣回空字串', () => {
    expect(extractWhy('## Why\n\n## What Changes\n\n有內容但不是 Why')).toBe('')
  })

  it('任意層級標題與大小寫都認得', () => {
    expect(extractWhy('# WHY\n\n一階全大寫。')).toBe('一階全大寫。')
    expect(extractWhy('###### why\n\n六階全小寫。')).toBe('六階全小寫。')
    expect(extractWhy('### Why \n\n標題後有空白。')).toBe('標題後有空白。')
  })
})
