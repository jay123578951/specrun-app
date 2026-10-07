import type { CliUpdateProbe } from './types'
import { describe, expect, it } from 'vitest'
import { normalizeCliUpdate } from './normalize-cli-update'

function probe(update: unknown, overrides: Partial<CliUpdateProbe> = {}): CliUpdateProbe {
  return { exitCode: 0, stdout: JSON.stringify({ schemaVersion: 1, version: '1.14.1', update }), stderr: '', ...overrides }
}

describe('normalizeCliUpdate', () => {
  it('available 帶 latest 與 command', () => {
    expect(normalizeCliUpdate(probe({ status: 'available', latest: '1.15.0', command: 'pnpm add -g @fission-ai/openspec@latest', canSelfUpgrade: false })))
      .toEqual({ status: 'available', latest: '1.15.0', command: 'pnpm add -g @fission-ai/openspec@latest' })
  })

  it('available 沒有 command（null）：只帶 latest', () => {
    expect(normalizeCliUpdate(probe({ status: 'available', latest: '1.15.0', command: null })))
      .toEqual({ status: 'available', latest: '1.15.0' })
  })

  it('available 缺 latest：無法檢查', () => {
    expect(normalizeCliUpdate(probe({ status: 'available' }))).toEqual({ status: 'unavailable' })
  })

  it('current', () => {
    expect(normalizeCliUpdate(probe({ status: 'current', latest: '1.14.1', command: null }))).toEqual({ status: 'current' })
  })

  it('offline、disabled、未知狀態：無法檢查', () => {
    for (const status of ['offline', 'disabled', 'whatever'])
      expect(normalizeCliUpdate(probe({ status }))).toEqual({ status: 'unavailable' })
  })

  it('非零結束、spawn 失敗、JSON 壞掉、缺 update：無法檢查', () => {
    expect(normalizeCliUpdate(probe({ status: 'current' }, { exitCode: 1 }))).toEqual({ status: 'unavailable' })
    expect(normalizeCliUpdate(probe(null, { exitCode: null, failure: { kind: 'spawn-failed', message: 'timeout' } }))).toEqual({ status: 'unavailable' })
    expect(normalizeCliUpdate(probe(null, { stdout: 'garbage' }))).toEqual({ status: 'unavailable' })
    expect(normalizeCliUpdate(probe(undefined))).toEqual({ status: 'unavailable' })
  })

  it('1.13.x 的輸出：低於 1.14', () => {
    expect(normalizeCliUpdate({ exitCode: 1, stdout: '', stderr: 'error: unknown option \'--check\'\n' })).toEqual({ status: 'too-old' })
    expect(normalizeCliUpdate({ exitCode: 1, stdout: '', stderr: 'error: unknown command \'version\'\n' })).toEqual({ status: 'too-old' })
  })

  it('available 的 command 為空字串：視同沒有指令', () => {
    expect(normalizeCliUpdate(probe({ status: 'available', latest: '1.15.0', command: '' })))
      .toEqual({ status: 'available', latest: '1.15.0' })
  })

  it('available 的 latest 不是字串或為空：無法檢查', () => {
    expect(normalizeCliUpdate(probe({ status: 'available', latest: 115 }))).toEqual({ status: 'unavailable' })
    expect(normalizeCliUpdate(probe({ status: 'available', latest: '' }))).toEqual({ status: 'unavailable' })
  })

  it('stdout 為 JSON null 或非物件的 update：無法檢查', () => {
    expect(normalizeCliUpdate(probe(null, { stdout: 'null' }))).toEqual({ status: 'unavailable' })
    expect(normalizeCliUpdate(probe('current'))).toEqual({ status: 'unavailable' })
  })

  it('逾時等 spawn 層失敗：即使 stdout 恰為合法 JSON 也不採用', () => {
    expect(normalizeCliUpdate(probe({ status: 'available', latest: '1.15.0' }, { failure: { kind: 'spawn-failed', message: 'timeout' } })))
      .toEqual({ status: 'unavailable' })
  })

  it('exit 0 且 stderr 有雜訊：仍照 stdout 解析', () => {
    expect(normalizeCliUpdate(probe({ status: 'current' }, { stderr: 'warn: something' }))).toEqual({ status: 'current' })
  })

  it('非零結束但不是舊版訊息：無法檢查，不是低於 1.14', () => {
    expect(normalizeCliUpdate({ exitCode: 1, stdout: '', stderr: 'error: boom' })).toEqual({ status: 'unavailable' })
  })
})
