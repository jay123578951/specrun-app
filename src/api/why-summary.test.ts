import { describe, expect, it } from 'vitest'
import { extractWhy } from './why-summary'

describe('extractWhy: proposal 首句摘錄', () => {
  it('只取 Why 段落的第一段第一句', () => {
    const proposal = '## Why\n\n第一句。第二句。\n\n第二段不要。\n\n## What Changes\n\n不相關\n'
    expect(extractWhy(proposal)).toBe('第一句。')
  })

  it('去掉行內 markdown 語法', () => {
    expect(extractWhy('## Why\n\n把 `code` 與 **粗體** 和 [連結](http://x) 攤平。'))
      .toBe('把 code 與 粗體 和 連結 攤平。')
  })

  it('英文句號同樣算句末', () => {
    expect(extractWhy('## Why\n\nParked changes add noise. Second sentence.')).toBe('Parked changes add noise.')
  })

  it('半形句號不接空白時不算句末，`design.md` 不被攔腰截斷', () => {
    expect(extractWhy('## Why\n\n細節見 design.md 的第二節。後續說明。'))
      .toBe('細節見 design.md 的第二節。')
    expect(extractWhy('## Why\n\nSee section 2.1 for details. Rest.'))
      .toBe('See section 2.1 for details.')
  })

  /**
   * 「句號＋空白」這條判準覆蓋不到後接空白的英文縮寫（`e.g. `、`i.e. `）——
   * 要分辨得懂縮寫詞表，成本遠高於摘錄這個輔助資訊值得付的價。
   * spec openspec-gateway 已把這個代價立為 scenario，不是待修的 bug。
   */
  it('後接空白的英文縮寫仍會被視為句末（spec 明文接受的代價）', () => {
    expect(extractWhy('## Why\n\nSee e.g. the second section. Rest.')).toBe('See e.g.')
  })

  it('段落無句末標點時回傳整段全文', () => {
    expect(extractWhy('## Why\n\n一句沒有句號的話')).toBe('一句沒有句號的話')
    // 同段落跨行也一起帶回，行間以空白接合
    expect(extractWhy('## Why\n\n沒有標點的第一行\n沒有標點的第二行'))
      .toBe('沒有標點的第一行 沒有標點的第二行')
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
