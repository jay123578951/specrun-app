import type { ResolveDeps, VerifyResult } from './cli-resolve'
import { describe, expect, it, vi } from 'vitest'
import { CLI_COMMAND, LOGIN_SHELL_PATH_MARKER, pickCommandPath, pickCommandPathAndSearchPath, pickVersion, resolveWith } from './cli-resolve'

/**
 * 只測解析的決策層（降級順序、覆寫優先、輸出取值）——spawn 全部注入。
 * 真正的 login shell 與 `--version` 由實機驗收，比照 folder-picker 的分法。
 */

function ok(version: string): VerifyResult {
  return { ok: true, version }
}

function fail(message = 'nope'): VerifyResult {
  return { ok: false, message }
}

/** 依「執行檔 → 驗證結果」的表造 verify；表外一律失敗 */
function verifier(table: Record<string, VerifyResult>): ResolveDeps['verify'] {
  return vi.fn(async (bin: string) => table[bin] ?? fail(`"${bin}" does not exist.`))
}

describe('resolveWith', () => {
  it('第一段（行程 PATH）命中就不進 login shell', async () => {
    const viaLoginShell = vi.fn(async () => ({ bin: '/opt/homebrew/bin/openspec', searchPath: '/usr/bin:/bin' }))
    const settings = await resolveWith({
      override: null,
      verify: verifier({ [CLI_COMMAND]: ok('1.2.3') }),
      viaLoginShell,
      locate: async () => '/opt/homebrew/bin/openspec',
      overrideSearchPath: null,
    })

    // 第一段命中時 bin 是還原後的絕對路徑——命令名跑得動不代表使用者知道跑的是哪一個檔案
    expect(settings).toEqual({
      mode: 'auto',
      bin: '/opt/homebrew/bin/openspec',
      version: '1.2.3',
      message: null,
    })
    expect(viaLoginShell).not.toHaveBeenCalled()
  })

  it('第一段未命中時借 login shell 取絕對路徑，且後續 verify 收到它一併帶回的搜尋路徑', async () => {
    const verify = vi.fn(async (bin: string, env?: Record<string, string>) => {
      if (bin === '/Users/me/Library/pnpm/openspec' && env?.PATH === '/usr/bin:/opt/homebrew/bin')
        return ok('1.2.3')
      return fail(`unexpected call: ${bin} ${JSON.stringify(env)}`)
    })
    const settings = await resolveWith({
      override: null,
      verify,
      viaLoginShell: async () => ({ bin: '/Users/me/Library/pnpm/openspec', searchPath: '/usr/bin:/opt/homebrew/bin' }),
      locate: async () => null,
      overrideSearchPath: null,
    })

    expect(settings).toEqual({
      mode: 'auto',
      bin: '/Users/me/Library/pnpm/openspec',
      version: '1.2.3',
      message: null,
      env: { PATH: '/usr/bin:/opt/homebrew/bin' },
    })
  })

  it('login shell 未命中（逾時、rc 出錯、找不到都是同一個 null）＝解析全數失敗', async () => {
    const settings = await resolveWith({
      override: null,
      verify: verifier({}),
      viaLoginShell: async () => null,
      locate: async () => null,
      overrideSearchPath: null,
    })

    expect(settings.bin).toBeNull()
    expect(settings.version).toBeNull()
    expect(settings.message).toContain('login shell')
  })

  it('login shell 找到了路徑，但拿它去驗證失敗——訊息要指得出是這一段執行失敗，不能沿用「找不到」那句', async () => {
    const settings = await resolveWith({
      override: null,
      verify: verifier({}), // 表外一律失敗，模擬「找到了但跑不動」（如轉接殼缺 node）
      viaLoginShell: async () => ({ bin: 'some rc noise', searchPath: '/usr/bin' }),
      locate: async () => null,
      overrideSearchPath: null,
    })

    expect(settings.bin).toBeNull()
    // 訊息要含實際的執行錯誤，且不是「找不到」那句
    expect(settings.message).toContain('"some rc noise" does not exist.')
    expect(settings.message).not.toContain('Could not find')
  })

  it('此環境不具備 login shell 能力時整段跳過（非 darwin）', async () => {
    const settings = await resolveWith({
      override: null,
      verify: verifier({}),
      viaLoginShell: null,
      locate: async () => null,
      overrideSearchPath: null,
    })

    expect(settings.bin).toBeNull()
    expect(settings.message).not.toContain('login shell')
  })

  it('明示覆寫優先於偵測，且不進行任何偵測', async () => {
    const verify = verifier({
      '/custom/openspec': ok('9.9.9'),
      [CLI_COMMAND]: ok('1.2.3'),
    })
    const viaLoginShell = vi.fn(async () => ({ bin: '/opt/homebrew/bin/openspec', searchPath: '/usr/bin' }))

    const locate = vi.fn(async () => '/opt/homebrew/bin/openspec')
    const settings = await resolveWith({ override: '/custom/openspec', verify, viaLoginShell, locate, overrideSearchPath: null })

    expect(settings).toEqual({
      mode: 'override',
      bin: '/custom/openspec',
      version: '9.9.9',
      message: null,
    })
    expect(verify).toHaveBeenCalledTimes(1)
    expect(viaLoginShell).not.toHaveBeenCalled()
    expect(locate).not.toHaveBeenCalled()
  })

  it('覆寫失效時停在失敗態，不偷偷退回自動偵測', async () => {
    const settings = await resolveWith({
      override: '/gone/openspec',
      verify: verifier({ [CLI_COMMAND]: ok('1.2.3') }),
      viaLoginShell: async () => ({ bin: '/opt/homebrew/bin/openspec', searchPath: '/usr/bin' }),
      locate: async () => '/opt/homebrew/bin/openspec',
      overrideSearchPath: null,
    })

    expect(settings.mode).toBe('override')
    expect(settings.bin).toBe('/gone/openspec')
    expect(settings.version).toBeNull()
    expect(settings.message).toContain('/gone/openspec')
  })

  it('手動指定模式下，驗證與最終結果都帶著登入 shell 一併問回的搜尋路徑', async () => {
    const verify = vi.fn(async (bin: string, env?: Record<string, string>) => {
      if (bin === '/custom/openspec' && env?.PATH === '/usr/bin:/opt/homebrew/bin')
        return ok('1.0.0')
      return fail(`unexpected call: ${bin} ${JSON.stringify(env)}`)
    })
    const overrideSearchPath = vi.fn(async () => '/usr/bin:/opt/homebrew/bin')

    const settings = await resolveWith({
      override: '/custom/openspec',
      verify,
      viaLoginShell: null,
      locate: async () => null,
      overrideSearchPath,
    })

    expect(settings).toEqual({
      mode: 'override',
      bin: '/custom/openspec',
      version: '1.0.0',
      message: null,
      env: { PATH: '/usr/bin:/opt/homebrew/bin' },
    })
    expect(overrideSearchPath).toHaveBeenCalledTimes(1)
  })

  it('手動指定模式下，此環境沒有搜尋路徑來源時不帶任何額外環境執行', async () => {
    const settings = await resolveWith({
      override: '/custom/openspec',
      verify: verifier({ '/custom/openspec': ok('1.0.0') }),
      viaLoginShell: null,
      locate: async () => null,
      overrideSearchPath: null,
    })

    expect(settings).toEqual({
      mode: 'override',
      bin: '/custom/openspec',
      version: '1.0.0',
      message: null,
    })
  })
})

describe('pickCommandPath', () => {
  it('取最後一行非空白內容，忽略 rc 檔雜訊', () => {
    const stdout = 'nvm: version manager loaded\n\n/Users/me/Library/pnpm/openspec\n'
    expect(pickCommandPath(stdout)).toBe('/Users/me/Library/pnpm/openspec')
  })

  it('全空白輸出（命令不存在時 command -v 不印東西）回 null', () => {
    expect(pickCommandPath('')).toBeNull()
    expect(pickCommandPath('\n  \n')).toBeNull()
  })
})

describe('pickVersion', () => {
  it('取第一行非空白內容', () => {
    expect(pickVersion('\n1.8.2\n')).toBe('1.8.2')
  })

  it('空輸出不編假版本，給一個可辨識的佔位', () => {
    expect(pickVersion('   ')).toBe('unknown version')
  })
})

describe('pickCommandPathAndSearchPath', () => {
  it('分隔字串之前套用 pickCommandPath 的規則，之後原樣 trim 當搜尋路徑', () => {
    const stdout = `nvm: version manager loaded\n\n/Users/me/Library/pnpm/openspec\n${LOGIN_SHELL_PATH_MARKER}/usr/bin:/opt/homebrew/bin`
    expect(pickCommandPathAndSearchPath(stdout)).toEqual({
      bin: '/Users/me/Library/pnpm/openspec',
      searchPath: '/usr/bin:/opt/homebrew/bin',
    })
  })

  it('command -v 找不到東西時，分隔字串前只有雜訊，bin 回 null，searchPath 仍問得到', () => {
    const stdout = `${LOGIN_SHELL_PATH_MARKER}/usr/bin:/bin`
    expect(pickCommandPathAndSearchPath(stdout)).toEqual({ bin: null, searchPath: '/usr/bin:/bin' })
  })

  it('分隔字串沒出現（例如輸出被截斷）視同兩者都沒問到，仍退回 pickCommandPath 的規則找 bin', () => {
    const stdout = '/Users/me/Library/pnpm/openspec\n'
    expect(pickCommandPathAndSearchPath(stdout)).toEqual({ bin: '/Users/me/Library/pnpm/openspec', searchPath: null })
  })
})
