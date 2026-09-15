import { describe, expect, it } from 'vitest'
import { isCheckedLine, isTaskLine, lineTextAt, toggleTaskLines } from './task-line'

/** 只翻勾選字元、其餘 byte 不動——「僅翻轉勾選標記」的落點 */
describe('toggleTaskLines', () => {
  /** 單顆點擊＝只帶一行的批次，兩者共用同一條路徑 */
  function one(content: string, line: number, expectedText: string, checked: boolean) {
    return toggleTaskLines(content, [{ line, expectedText }], checked)
  }

  it('翻轉 `-` 清單的未勾選項', () => {
    const content = '- [ ] build it\n'
    expect(one(content, 0, '- [ ] build it', true))
      .toEqual({ ok: true, content: '- [x] build it\n' })
  })

  it.each(['*', '+'])('認得 `%s` 作為清單標記', (marker) => {
    const content = `${marker} [ ] task\n`
    expect(one(content, 0, `${marker} [ ] task`, true))
      .toEqual({ ok: true, content: `${marker} [x] task\n` })
  })

  it.each(['1.', '12)'])('認得有序清單標記 `%s`', (marker) => {
    const content = `${marker} [x] task\n`
    expect(one(content, 0, `${marker} [x] task`, false))
      .toEqual({ ok: true, content: `${marker} [ ] task\n` })
  })

  it('翻轉縮排子項時保留縮排', () => {
    const content = 'top\n    - [ ] nested\n'
    expect(one(content, 1, '    - [ ] nested', true))
      .toEqual({ ok: true, content: 'top\n    - [x] nested\n' })
  })

  it('大寫 `X` 視為已勾選，取消時寫回空格', () => {
    expect(isCheckedLine('- [X] done')).toBe(true)
    expect(one('- [X] done\n', 0, '- [X] done', false))
      .toEqual({ ok: true, content: '- [ ] done\n' })
  })

  it('維持 CRLF 檔案的行尾符', () => {
    const content = '# Tasks\r\n- [ ] a\r\n- [ ] b\r\n'
    expect(one(content, 1, '- [ ] a', true))
      .toEqual({ ok: true, content: '# Tasks\r\n- [x] a\r\n- [ ] b\r\n' })
  })

  it('檔尾無換行時不補換行', () => {
    expect(one('- [ ] a\n- [ ] last', 1, '- [ ] last', true))
      .toEqual({ ok: true, content: '- [ ] a\n- [x] last' })
  })

  it('目標行已被改寫則回衝突、不寫入', () => {
    expect(one('- [ ] renamed\n', 0, '- [ ] original', true))
      .toEqual({ ok: false, reason: 'conflict' })
  })

  it('目標行已不存在（檔案被截短）也算衝突', () => {
    expect(one('- [ ] a\n', 7, '- [ ] a', true))
      .toEqual({ ok: false, reason: 'conflict' })
  })

  it('其他行的外部修改不阻擋寫入，且原樣保留', () => {
    const content = '- [ ] target\n- [x] edited elsewhere\nnew line from outside\n'
    expect(one(content, 0, '- [ ] target', true))
      .toEqual({
        ok: true,
        content: '- [x] target\n- [x] edited elsewhere\nnew line from outside\n',
      })
  })

  it('行文相符但不是 task 行則拒絕', () => {
    expect(one('just a paragraph\n', 0, 'just a paragraph', true))
      .toEqual({ ok: false, reason: 'not-a-task-line' })
  })

  it('重複翻同一方向不改變內容（冪等）', () => {
    expect(one('- [x] a\n', 0, '- [x] a', true))
      .toEqual({ ok: true, content: '- [x] a\n' })
  })

  it('空的 edits 不改動任何內容', () => {
    expect(toggleTaskLines('- [ ] a\n', [], true))
      .toEqual({ ok: true, content: '- [ ] a\n' })
  })

  /** 批次勾選：一次翻 N 行，未列入的行與非 task 行整段保持原樣 */
  it('一次翻轉多行，其餘 byte 不變', () => {
    const content = '## 1. Section\n- [ ] a\n- [x] done\n  - [ ] b\n\nplain paragraph\n- [ ] c\n'
    expect(toggleTaskLines(content, [
      { line: 1, expectedText: '- [ ] a' },
      { line: 3, expectedText: '  - [ ] b' },
      { line: 6, expectedText: '- [ ] c' },
    ], true)).toEqual({
      ok: true,
      content: '## 1. Section\n- [x] a\n- [x] done\n  - [x] b\n\nplain paragraph\n- [x] c\n',
    })
  })

  it('混合縮排與大寫標記的批次一次翻完', () => {
    const content = '- [ ] a\r\n\t- [X] b\r\n  1) [ ] c\r\n'
    expect(toggleTaskLines(content, [
      { line: 0, expectedText: '- [ ] a' },
      { line: 1, expectedText: '\t- [X] b' },
      { line: 2, expectedText: '  1) [ ] c' },
    ], true)).toEqual({
      ok: true,
      content: '- [x] a\r\n\t- [x] b\r\n  1) [x] c\r\n',
    })
  })

  it('批次中單行不符則整批不產出內容', () => {
    const content = '- [ ] a\n- [ ] renamed\n- [ ] c\n'
    expect(toggleTaskLines(content, [
      { line: 0, expectedText: '- [ ] a' },
      { line: 1, expectedText: '- [ ] original' },
      { line: 2, expectedText: '- [ ] c' },
    ], true)).toEqual({ ok: false, reason: 'conflict' })
  })

  it('批次中夾到非 task 行則整批不產出內容', () => {
    const content = '- [ ] a\nplain paragraph\n'
    expect(toggleTaskLines(content, [
      { line: 0, expectedText: '- [ ] a' },
      { line: 1, expectedText: 'plain paragraph' },
    ], true)).toEqual({ ok: false, reason: 'not-a-task-line' })
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
