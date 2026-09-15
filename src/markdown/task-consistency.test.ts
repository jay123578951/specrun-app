import { describe, expect, it } from 'vitest'
import { isTaskLine, splitLines } from '../utils/task-line'
import { renderMarkdown } from './render'

/**
 * 「可勾選項的判定一致性」：畫面渲染成可互動 checkbox 的行，
 * 伺服端的 regex 必須認得。這裡把同一份樣本同時餵兩邊，plugin 升版導致漂移時先紅。
 */

/** 渲染後帶 `data-line` 的 checkbox 落在哪些來源行——即畫面上點得下去的集合 */
async function renderedLines(source: string): Promise<number[]> {
  const html = await renderMarkdown(source, { interactive: true })
  return [...html.matchAll(/data-line="(\d+)"/g)].map(match => Number(match[1])).sort((a, b) => a - b)
}

/** 伺服端 regex 認得的行 */
function serverLines(source: string): number[] {
  return splitLines(source)
    .map((raw, index) => ({ index, text: raw.replace(/\r?\n$/, '') }))
    .filter(line => isTaskLine(line.text))
    .map(line => line.index)
}

const SAMPLE = [
  '# Tasks',
  '',
  '## 1. 群組',
  '',
  '- [ ] 未勾選的 `-` 項目',
  '- [x] 已勾選的項目',
  '- [X] 大寫勾選',
  '* [ ] 星號標記',
  '+ [ ] 加號標記',
  '  - [ ] 縮排子項',
  '',
  '1. [ ] 有序清單（點）',
  '2) [x] 有序清單（括號）',
  '',
  '- 一般清單項，不是 task',
  '普通段落 [ ] 看起來像但沒有清單標記',
  '- [ ]',
  '- [y] 不是勾選字元',
].join('\n')

describe('可勾選項的判定一致性', () => {
  it('前端渲染出的可點行與伺服端認定完全一致', async () => {
    const rendered = await renderedLines(SAMPLE)

    expect(rendered).toEqual(serverLines(SAMPLE))
    // 樣本真的涵蓋各種標記，不是兩邊都認 0 行的空一致
    expect(rendered).toHaveLength(8)
  })

  it('唯讀模式不輸出 data-line，checkbox 維持 disabled', async () => {
    const html = await renderMarkdown(SAMPLE)

    expect(html).not.toContain('data-line')
    expect(html).toContain('disabled')
  })

  it('interactive 模式的 checkbox 不帶 disabled', async () => {
    const html = await renderMarkdown('- [ ] a\n', { interactive: true })

    expect(html).toContain('data-line="0"')
    expect(html).not.toContain('disabled')
  })

  it('code fence 內的 task 行不可點——伺服端多認的方向是安全的', async () => {
    const source = ['- [ ] real', '', '```md', '- [ ] inside a fence', '```', ''].join('\n')
    const rendered = await renderedLines(source)

    expect(rendered).toEqual([0])
    // 前端可點 ⊆ 伺服端認得：spec 要求的方向成立（反向多認的行點不到，寫不進去）
    expect(serverLines(source)).toEqual(expect.arrayContaining(rendered))
  })
})
