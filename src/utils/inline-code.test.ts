import { describe, expect, it } from 'vitest'
import { splitInlineCode } from './inline-code'

describe('splitInlineCode：標題拆成文字／code 片段（Roadmap 卡片與面板 header 標題共用）', () => {
  it('無反引號：整段為單一文字片段', () => {
    expect(splitInlineCode('培訓機構管理')).toEqual([{ text: '培訓機構管理', code: false }])
  })

  it('單一反引號片段：拆成前後文字＋code 三段', () => {
    expect(splitInlineCode('色彩透明度寫法失效（`/N`）')).toEqual([
      { text: '色彩透明度寫法失效（', code: false },
      { text: '/N', code: true },
      { text: '）', code: false },
    ])
  })

  it('整段就是反引號片段：不產生空的文字片段', () => {
    expect(splitInlineCode('`00-執行順序.md`')).toEqual([{ text: '00-執行順序.md', code: true }])
  })

  it('多個反引號片段：依序交替排列', () => {
    expect(splitInlineCode('`a` 與 `b`')).toEqual([
      { text: 'a', code: true },
      { text: ' 與 ', code: false },
      { text: 'b', code: true },
    ])
  })
})
