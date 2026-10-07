import { describe, expect, it } from 'vitest'
import { isCliTooOld } from './cli-version'

describe('isCliTooOld', () => {
  it('1.13.2 對 list --archived 的實際輸出：過舊', () => {
    expect(isCliTooOld({ exitCode: 1, stderr: 'error: unknown option \'--archived\'\n' })).toBe(true)
  })

  it('1.13.x 對 version --check 的拒絕：過舊', () => {
    expect(isCliTooOld({ exitCode: 1, stderr: 'error: unknown option \'--check\'\n' })).toBe(true)
    expect(isCliTooOld({ exitCode: 1, stderr: 'error: unknown command \'version\'\n' })).toBe(true)
  })

  it('帶顏色碼的訊息一樣辨識', () => {
    expect(isCliTooOld({ exitCode: 1, stderr: '\u001B[31merror: unknown option \'--archived\'\u001B[0m' })).toBe(true)
  })

  it('1.14.0 與 1.14.1 成功執行（exit 0，stderr 空）：不過舊', () => {
    expect(isCliTooOld({ exitCode: 0, stderr: '' })).toBe(false)
  })

  it('其他錯誤、spawn 失敗、無結束代碼：不是版本問題', () => {
    expect(isCliTooOld({ exitCode: 1, stderr: 'some other error' })).toBe(false)
    expect(isCliTooOld({ exitCode: null, stderr: '', failure: { kind: 'cli-unavailable', message: 'ENOENT' } })).toBe(false)
    expect(isCliTooOld({ exitCode: null, stderr: 'unknown option \'--archived\'' })).toBe(false)
  })

  it('spawn 層失敗時就算 stderr 有舊版字樣也不判過舊（先是通道問題）', () => {
    expect(isCliTooOld({ exitCode: 1, stderr: 'error: unknown option \'--archived\'', failure: { kind: 'spawn-failed', message: 'timeout' } })).toBe(false)
  })

  it('exit 0 時 stderr 即使出現字樣也不判過舊；其他未知選項不算', () => {
    expect(isCliTooOld({ exitCode: 0, stderr: 'unknown option \'--archived\'' })).toBe(false)
    expect(isCliTooOld({ exitCode: 1, stderr: 'error: unknown option \'--foo\'' })).toBe(false)
    expect(isCliTooOld({ exitCode: 1, stderr: 'error: unknown command \'list2\'' })).toBe(false)
  })
})
