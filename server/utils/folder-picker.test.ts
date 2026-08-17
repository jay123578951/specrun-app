import { describe, expect, it } from 'vitest'
import { mapOsascriptResult } from './folder-picker'

/**
 * 只測「exit code＋stdout＋stderr → outcome」這層映射（design D3）；
 * spawn 本身不測，dialog 由實機驗收。
 */
describe('mapOsascriptResult', () => {
  it('exit 0 取 stdout 為路徑，並修掉尾端換行', () => {
    expect(mapOsascriptResult({ exitCode: 0, stdout: '/Users/me/repo/\n', stderr: '' }))
      .toEqual({ status: 'picked', path: '/Users/me/repo/' })
  })

  it('exit 0 但 stdout 為空時算失敗，不回空路徑', () => {
    expect(mapOsascriptResult({ exitCode: 0, stdout: '\n', stderr: '' }))
      .toEqual({ status: 'failed' })
  })

  it('使用者取消（非 0 且 stderr 含 User canceled）算 canceled', () => {
    expect(mapOsascriptResult({
      exitCode: 1,
      stdout: '',
      stderr: 'execution error: User canceled. (-128)',
    })).toEqual({ status: 'canceled' })
  })

  it('其餘非 0 exit 一律 failed', () => {
    expect(mapOsascriptResult({ exitCode: 2, stdout: '', stderr: 'syntax error' }))
      .toEqual({ status: 'failed' })
  })

  it('spawn 未成立（exitCode 為 null）算 failed', () => {
    expect(mapOsascriptResult({ exitCode: null, stdout: '', stderr: 'spawn ENOENT' }))
      .toEqual({ status: 'failed' })
  })
})
