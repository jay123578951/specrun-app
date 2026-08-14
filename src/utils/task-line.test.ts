import { describe, expect, it } from 'vitest'
import { isCheckedLine, isTaskLine, lineTextAt, toggleTaskLine } from './task-line'

/** 只翻一個字元、其餘 byte 不動——spec openspec-gateway「僅翻轉勾選標記」的落點 */
describe('toggleTaskLine', () => {
  it('翻轉 `-` 清單的未勾選項', () => {
    const content = '- [ ] build it\n'
    expect(toggleTaskLine(content, 0, '- [ ] build it', true))
      .toEqual({ ok: true, content: '- [x] build it\n' })
  })

  it.each(['*', '+'])('認得 `%s` 作為清單標記', (marker) => {
    const content = `${marker} [ ] task\n`
    expect(toggleTaskLine(content, 0, `${marker} [ ] task`, true))
      .toEqual({ ok: true, content: `${marker} [x] task\n` })
  })

  it.each(['1.', '12)'])('認得有序清單標記 `%s`', (marker) => {
    const content = `${marker} [x] task\n`
    expect(toggleTaskLine(content, 0, `${marker} [x] task`, false))
      .toEqual({ ok: true, content: `${marker} [ ] task\n` })
  })

  it('翻轉縮排子項時保留縮排', () => {
    const content = 'top\n    - [ ] nested\n'
    expect(toggleTaskLine(content, 1, '    - [ ] nested', true))
      .toEqual({ ok: true, content: 'top\n    - [x] nested\n' })
  })

  it('大寫 `X` 視為已勾選，取消時寫回空格', () => {
    expect(isCheckedLine('- [X] done')).toBe(true)
    expect(toggleTaskLine('- [X] done\n', 0, '- [X] done', false))
      .toEqual({ ok: true, content: '- [ ] done\n' })
  })

  it('維持 CRLF 檔案的行尾符', () => {
    const content = '# Tasks\r\n- [ ] a\r\n- [ ] b\r\n'
    expect(toggleTaskLine(content, 1, '- [ ] a', true))
      .toEqual({ ok: true, content: '# Tasks\r\n- [x] a\r\n- [ ] b\r\n' })
  })

  it('檔尾無換行時不補換行', () => {
    expect(toggleTaskLine('- [ ] a\n- [ ] last', 1, '- [ ] last', true))
      .toEqual({ ok: true, content: '- [ ] a\n- [x] last' })
  })

  it('目標行已被改寫則回衝突、不寫入', () => {
    expect(toggleTaskLine('- [ ] renamed\n', 0, '- [ ] original', true))
      .toEqual({ ok: false, reason: 'conflict' })
  })

  it('目標行已不存在（檔案被截短）也算衝突', () => {
    expect(toggleTaskLine('- [ ] a\n', 7, '- [ ] a', true))
      .toEqual({ ok: false, reason: 'conflict' })
  })

  it('其他行的外部修改不阻擋寫入，且原樣保留', () => {
    const content = '- [ ] target\n- [x] edited elsewhere\nnew line from outside\n'
    expect(toggleTaskLine(content, 0, '- [ ] target', true))
      .toEqual({
        ok: true,
        content: '- [x] target\n- [x] edited elsewhere\nnew line from outside\n',
      })
  })

  it('行文相符但不是 task 行則拒絕', () => {
    expect(toggleTaskLine('just a paragraph\n', 0, 'just a paragraph', true))
      .toEqual({ ok: false, reason: 'not-a-task-line' })
  })

  it('重複翻同一方向不改變內容（冪等）', () => {
    expect(toggleTaskLine('- [x] a\n', 0, '- [x] a', true))
      .toEqual({ ok: true, content: '- [x] a\n' })
  })
})

describe('isTaskLine', () => {
  it.each([
    '- [ ] a',
    '- [x] a',
    '  - [X] a',
    '* [ ] a',
    '+ [ ] a',
    '1. [ ] a',
    '3) [x] a',
    '-\t[ ]\ta',
  ])('認得 %j', (line) => {
    expect(isTaskLine(line)).toBe(true)
  })

  it.each([
    '- [ ]', // 括號後沒有內容——plugin 也不當 task
    '- [ ] ', // 同上，尾端只有空白
    '[ ] a', // 沒有清單標記
    '-[ ] a', // 標記後沒有空白，markdown-it 不當清單
    '- [y] a', // 不是勾選字元
    '- [] a',
    'plain text',
    '',
  ])('不認 %j', (line) => {
    expect(isTaskLine(line)).toBe(false)
  })
})

describe('lineTextAt', () => {
  it('回傳去行尾符的原文', () => {
    expect(lineTextAt('a\r\nb\n', 0)).toBe('a')
    expect(lineTextAt('a\r\nb\n', 1)).toBe('b')
  })

  it('行不存在回 null', () => {
    expect(lineTextAt('a\n', 5)).toBeNull()
  })
})
