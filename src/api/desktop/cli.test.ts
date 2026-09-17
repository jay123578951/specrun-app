import type { AppConfig } from '../app-config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CLI_COMMAND } from '../cli-resolve'

/**
 * 桌面 CLI 解析的接線層。決策層（優先序、三段降級）已在 ../cli-resolve.test.ts
 * 測過，這裡只測「怎麼跑一個指令」這一層自己的規則：三個 spawn 點怎麼組參數、
 * redetect／applyOverride 怎麼跟設定檔互動、runCli 的短路條件——全部注入假的
 * 外殼通道（vi.mock('./shell')）與假的設定檔持有處（vi.mock('./config-store')）。
 *
 * 每個測試都 resetModules 後重新 import，因為 cliSettings() 的解析結果
 * 是模組層級的單例快取，不重置會被前一個測試的狀態汙染。
 *
 * 四組上限數字（資料請求 15s／4MB、--version 驗證 5s／1MB、locate 與 login shell
 * 偵測各 3s／1MB）要與 web 形態同一批 spawn 點一致，見 server/utils/openspec-cli.ts
 * 與 server/utils/cli-resolver.ts。這裡用字面值寫死，不從 ./cli 匯入常數——常數本身
 * 沒有 export，且就算 export 了，斷言若照抄同一個識別字，把兩組常數對調
 * 或全設成 0 一樣會全綠（自己對自己一致），驗不出「數字對不對」。
 */

interface SpawnResult {
  status: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  truncated: boolean
}
type SpawnOutcome = { ok: true, result: SpawnResult } | { ok: false, message: string }
interface SpawnLimits { timeoutMs: number, maxOutputBytes: number }

const DATA_LIMITS: SpawnLimits = { timeoutMs: 15_000, maxOutputBytes: 4 * 1024 * 1024 }
const VERIFY_LIMITS: SpawnLimits = { timeoutMs: 5_000, maxOutputBytes: 1024 * 1024 }
/** locate（非互動 `command -v`）與 viaLoginShell（互動 login shell）刻意同一組數字 */
const SHELL_LIMITS: SpawnLimits = { timeoutMs: 3_000, maxOutputBytes: 1024 * 1024 }

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { projects: [], lastActivePath: null, openspecBin: null, ...overrides }
}

function makeConfigStore(initial: AppConfig) {
  const state = { ...initial }
  return { config: vi.fn(async () => state), persist: vi.fn(async () => {}), state }
}

interface Route {
  match: (program: string, args: string[]) => boolean
  outcome: SpawnOutcome
}

function makeShell(routes: Route[], options: { windows?: boolean } = {}) {
  return {
    homePath: vi.fn(async () => '/home/x'),
    isWindows: vi.fn(async () => options.windows ?? false),
    isMacOS: vi.fn(async () => !(options.windows ?? false)),
    resolveUserPath: vi.fn(async (input: string) => `/resolved${input}`),
    spawnBin: vi.fn(async (program: string, args: string[], _cwd: string, _limits: SpawnLimits): Promise<SpawnOutcome> => {
      const route = routes.find(each => each.match(program, args))
      if (!route)
        throw new Error(`unstubbed spawnBin(${program}, ${JSON.stringify(args)})`)
      return route.outcome
    }),
  }
}

function ok(stdout: string): SpawnOutcome {
  return { ok: true, result: { status: 0, stdout, stderr: '', timedOut: false, truncated: false } }
}
function fail(message: string): SpawnOutcome {
  return { ok: false, message }
}
function timedOut(): SpawnOutcome {
  return { ok: true, result: { status: null, stdout: '', stderr: '', timedOut: true, truncated: false } }
}
function truncated(stdout = ''): SpawnOutcome {
  return { ok: true, result: { status: 0, stdout, stderr: '', timedOut: false, truncated: true } }
}
function nonZero(stderr: string): SpawnOutcome {
  return { ok: true, result: { status: 1, stdout: '', stderr, timedOut: false, truncated: false } }
}

const isVersionCall = (_program: string, args: string[]) => args[0] === '--version'
function isLocate(program: string, args: string[]) {
  return program === '/bin/sh' && args.join(' ').includes(`command -v ${CLI_COMMAND}`) && !args.join(' ').includes('exec')
}
function isLoginShell(program: string, args: string[]) {
  return program === '/bin/sh' && args.join(' ').includes('exec')
}

describe('desktop/cli', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('覆寫有效時直接採用，不嘗試任何偵測；--version 帶 5 秒／1MiB 上限與 homePath 當 cwd', async () => {
    const store = makeConfigStore(makeConfig({ openspecBin: '/custom/openspec' }))
    const shell = makeShell([
      { match: (p, a) => p === '/custom/openspec' && isVersionCall(p, a), outcome: ok('9.9.9') },
    ])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { cliSettings } = await import('./cli')

    expect(await cliSettings()).toEqual({ mode: 'override', bin: '/custom/openspec', version: '9.9.9', message: null })
    expect(shell.spawnBin).toHaveBeenCalledTimes(1)
    expect(shell.spawnBin).toHaveBeenCalledWith('/custom/openspec', ['--version'], '/home/x', VERIFY_LIMITS)
  })

  it('覆寫失效時停在失敗態，不偷偷退回自動偵測；驗證呼叫一樣帶 5 秒／1MiB 上限', async () => {
    const store = makeConfigStore(makeConfig({ openspecBin: '/gone/openspec' }))
    const shell = makeShell([
      { match: (p, a) => p === '/gone/openspec' && isVersionCall(p, a), outcome: fail('spawn ENOENT') },
    ])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { cliSettings } = await import('./cli')

    const settings = await cliSettings()
    expect(settings.mode).toBe('override')
    expect(settings.bin).toBe('/gone/openspec')
    expect(settings.version).toBeNull()
    expect(settings.message).toContain('/gone/openspec')
    expect(shell.spawnBin).toHaveBeenCalledTimes(1)
    expect(shell.spawnBin).toHaveBeenCalledWith('/gone/openspec', ['--version'], '/home/x', VERIFY_LIMITS)
  })

  it('無覆寫、行程 PATH 命中：呈現還原後的絕對路徑，不進 login shell；兩趟 spawn 各自的上限與 cwd 都對得上', async () => {
    const store = makeConfigStore(makeConfig())
    const shell = makeShell([
      { match: (p, a) => p === CLI_COMMAND && isVersionCall(p, a), outcome: ok('1.2.3') },
      { match: isLocate, outcome: ok('/opt/homebrew/bin/openspec') },
    ])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { cliSettings } = await import('./cli')

    expect(await cliSettings()).toEqual({ mode: 'auto', bin: '/opt/homebrew/bin/openspec', version: '1.2.3', message: null })
    expect(shell.spawnBin).toHaveBeenCalledTimes(2)
    expect(shell.spawnBin).toHaveBeenCalledWith(CLI_COMMAND, ['--version'], '/home/x', VERIFY_LIMITS)
    expect(shell.spawnBin).toHaveBeenCalledWith('/bin/sh', ['-c', `command -v ${CLI_COMMAND}`], '/home/x', SHELL_LIMITS)
  })

  it('無覆寫、行程 PATH 未命中、login shell 命中：採用其絕對路徑；login shell 那一趟帶 3 秒／1MiB 上限', async () => {
    const store = makeConfigStore(makeConfig())
    const shell = makeShell([
      { match: (p, a) => p === CLI_COMMAND && isVersionCall(p, a), outcome: fail('not found') },
      { match: isLoginShell, outcome: ok('/Users/me/Library/pnpm/openspec') },
      { match: (p, a) => p === '/Users/me/Library/pnpm/openspec' && isVersionCall(p, a), outcome: ok('1.2.3') },
    ])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { cliSettings } = await import('./cli')

    expect(await cliSettings()).toEqual({ mode: 'auto', bin: '/Users/me/Library/pnpm/openspec', version: '1.2.3', message: null })
    expect(shell.spawnBin).toHaveBeenCalledWith(
      '/bin/sh',
      ['-c', `exec "\${SHELL:-/bin/zsh}" -ilc "command -v ${CLI_COMMAND}"`],
      '/home/x',
      SHELL_LIMITS,
    )
    expect(shell.spawnBin).toHaveBeenCalledWith('/Users/me/Library/pnpm/openspec', ['--version'], '/home/x', VERIFY_LIMITS)
  })

  it('login shell 逾時視同未命中，不掛住，回報全數未命中', async () => {
    const store = makeConfigStore(makeConfig())
    const shell = makeShell([
      { match: (p, a) => p === CLI_COMMAND && isVersionCall(p, a), outcome: fail('not found') },
      { match: isLoginShell, outcome: timedOut() },
    ])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { cliSettings } = await import('./cli')

    const settings = await cliSettings()
    expect(settings.bin).toBeNull()
    expect(settings.message).toContain('login shell')
    expect(shell.spawnBin).toHaveBeenCalledWith('/bin/sh', expect.arrayContaining(['-c']), '/home/x', SHELL_LIMITS)
  })

  it('locate（非互動 command -v）輸出爆量時視同未命中，不當成命中，繼續往 login shell 找', async () => {
    const store = makeConfigStore(makeConfig())
    const shell = makeShell([
      { match: (p, a) => p === CLI_COMMAND && isVersionCall(p, a), outcome: fail('not found') },
      { match: isLocate, outcome: truncated('/opt/homebrew/bin/open') },
      { match: isLoginShell, outcome: ok('/Users/me/Library/pnpm/openspec') },
      { match: (p, a) => p === '/Users/me/Library/pnpm/openspec' && isVersionCall(p, a), outcome: ok('1.2.3') },
    ])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { cliSettings } = await import('./cli')

    const settings = await cliSettings()
    // 若 truncated 沒被當失敗，locate 會被誤判命中並直接採用被截斷的路徑
    expect(settings.bin).toBe('/Users/me/Library/pnpm/openspec')
  })

  it('windows 環境不嘗試 login shell（isWindows() 決定跳過整段），版本探測仍帶正確上限', async () => {
    const store = makeConfigStore(makeConfig())
    const shell = makeShell([
      { match: (p, a) => p === CLI_COMMAND && isVersionCall(p, a), outcome: fail('not found') },
    ], { windows: true })
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { cliSettings } = await import('./cli')

    const settings = await cliSettings()
    expect(settings.bin).toBeNull()
    expect(settings.message).not.toContain('login shell')
    expect(shell.spawnBin).toHaveBeenCalledTimes(1)
    expect(shell.spawnBin).toHaveBeenCalledWith(CLI_COMMAND, ['--version'], '/home/x', VERIFY_LIMITS)
  })

  it('redetect：清空持久化覆寫、寫回設定檔，並重新解析出新結果（各趟 spawn 上限維持各自的值）', async () => {
    const store = makeConfigStore(makeConfig({ openspecBin: '/gone/openspec' }))
    const shell = makeShell([
      { match: (p, a) => p === '/gone/openspec' && isVersionCall(p, a), outcome: fail('nope') },
      { match: (p, a) => p === CLI_COMMAND && isVersionCall(p, a), outcome: ok('1.2.3') },
      { match: isLocate, outcome: ok('/opt/homebrew/bin/openspec') },
    ])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { cliSettings, redetect } = await import('./cli')

    expect((await cliSettings()).mode).toBe('override')

    const settings = await redetect()
    expect(store.state.openspecBin).toBeNull()
    expect(store.persist).toHaveBeenCalled()
    expect(settings).toEqual({ mode: 'auto', bin: '/opt/homebrew/bin/openspec', version: '1.2.3', message: null })
    expect(await cliSettings()).toEqual(settings)
    expect(shell.spawnBin).toHaveBeenCalledWith(CLI_COMMAND, ['--version'], '/home/x', VERIFY_LIMITS)
    expect(shell.spawnBin).toHaveBeenCalledWith('/bin/sh', ['-c', `command -v ${CLI_COMMAND}`], '/home/x', SHELL_LIMITS)
  })

  it('applyOverride：空白輸入直接拒絕，不動設定檔', async () => {
    const store = makeConfigStore(makeConfig())
    const shell = makeShell([])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { applyOverride } = await import('./cli')

    const result = await applyOverride('   ')
    expect(result).toEqual({ ok: false, message: 'Enter the path to the openspec executable.' })
    expect(store.persist).not.toHaveBeenCalled()
  })

  it('applyOverride：驗證失敗時不寫入，目前生效者不變；驗證呼叫帶 5 秒／1MiB 上限', async () => {
    const store = makeConfigStore(makeConfig())
    const shell = makeShell([
      { match: (p, a) => p === CLI_COMMAND && isVersionCall(p, a), outcome: ok('1.0.0') },
      { match: isLocate, outcome: ok('/usr/bin/openspec') },
      { match: (p, a) => p === '/resolved/bad/path' && isVersionCall(p, a), outcome: fail('does not exist') },
    ])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { applyOverride, cliSettings } = await import('./cli')

    const before = await cliSettings()
    const result = await applyOverride('/bad/path')

    expect(result.ok).toBe(false)
    expect(store.persist).not.toHaveBeenCalled()
    expect(store.state.openspecBin).toBeNull()
    expect(await cliSettings()).toEqual(before)
    expect(shell.spawnBin).toHaveBeenCalledWith('/resolved/bad/path', ['--version'], '/home/x', VERIFY_LIMITS)
  })

  it('applyOverride：驗證逾時時訊息帶出上限秒數，不寫入', async () => {
    const store = makeConfigStore(makeConfig())
    const shell = makeShell([
      { match: (p, a) => p === '/resolved/slow/path' && isVersionCall(p, a), outcome: timedOut() },
    ])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { applyOverride } = await import('./cli')

    const result = await applyOverride('/slow/path')
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.message).toContain('5000ms')
    expect(store.persist).not.toHaveBeenCalled()
  })

  it('applyOverride：驗證輸出爆量時訊息帶出位元組上限，不寫入', async () => {
    const store = makeConfigStore(makeConfig())
    const shell = makeShell([
      { match: (p, a) => p === '/resolved/noisy/path' && isVersionCall(p, a), outcome: truncated('x'.repeat(10)) },
    ])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { applyOverride } = await import('./cli')

    const result = await applyOverride('/noisy/path')
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.message).toContain(String(VERIFY_LIMITS.maxOutputBytes))
    expect(store.persist).not.toHaveBeenCalled()
  })

  it('applyOverride：驗證非零結束時訊息帶出 stderr 首行，不寫入', async () => {
    const store = makeConfigStore(makeConfig())
    const shell = makeShell([
      { match: (p, a) => p === '/resolved/broken/path' && isVersionCall(p, a), outcome: nonZero('  permission denied  \nsome trace') },
    ])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { applyOverride } = await import('./cli')

    const result = await applyOverride('/broken/path')
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.message).toContain('permission denied')
    expect(store.persist).not.toHaveBeenCalled()
  })

  it('applyOverride：驗證成功後寫入設定檔，且後續 cliSettings 立即反映新結果不重跑驗證', async () => {
    const store = makeConfigStore(makeConfig())
    const shell = makeShell([
      { match: (p, a) => p === '/resolved/good/path' && isVersionCall(p, a), outcome: ok('2.0.0') },
    ])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { applyOverride, cliSettings } = await import('./cli')

    const result = await applyOverride('  /good/path  ')
    expect(result).toEqual({
      ok: true,
      settings: { mode: 'override', bin: '/resolved/good/path', version: '2.0.0', message: null },
    })
    expect(shell.resolveUserPath).toHaveBeenCalledWith('/good/path')
    expect(store.state.openspecBin).toBe('/resolved/good/path')
    expect(store.persist).toHaveBeenCalledTimes(1)
    expect(shell.spawnBin).toHaveBeenCalledWith('/resolved/good/path', ['--version'], '/home/x', VERIFY_LIMITS)

    const after = await cliSettings()
    expect(result.ok && after).toEqual(result.ok ? result.settings : undefined)
    expect(shell.spawnBin).toHaveBeenCalledTimes(1)
  })

  it('runCli：尚未解析出任何可用執行檔時不 spawn 資料請求，直接歸 CLI 不可用', async () => {
    const store = makeConfigStore(makeConfig())
    const shell = makeShell([
      { match: (p, a) => p === CLI_COMMAND && isVersionCall(p, a), outcome: fail('not found') },
    ], { windows: true })
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { cliSettings, runCli } = await import('./cli')

    const result = await runCli(['list', '--json'], '/some/project')
    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.failure.kind).toBe('cli-unavailable')
    // 訊息取自解析結果本身，不另編一句——那一句已寫得出「在哪裡找過」
    expect(result.failure.message).toBe((await cliSettings()).message)
    expect(result.failure.message).toContain(`Could not find "${CLI_COMMAND}"`)
    expect(shell.spawnBin).toHaveBeenCalledTimes(1)
  })

  it('runCli：跑完了就交出結束代碼與兩股輸出，且呼叫端傳入的 cwd 原樣送到 spawnBin、帶 15 秒／4MiB 資料上限', async () => {
    const store = makeConfigStore(makeConfig({ openspecBin: '/custom/openspec' }))
    const shell = makeShell([
      { match: (p, a) => p === '/custom/openspec' && isVersionCall(p, a), outcome: ok('1.0.0') },
      { match: (p, a) => p === '/custom/openspec' && a[0] === 'list', outcome: ok('{"changes":[]}') },
    ])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { runCli } = await import('./cli')

    const result = await runCli(['list', '--json'], '/some/project')
    expect(result).toEqual({ ok: true, exitCode: 0, stdout: '{"changes":[]}', stderr: '' })
    expect(shell.spawnBin).toHaveBeenCalledWith('/custom/openspec', ['list', '--json'], '/some/project', DATA_LIMITS)
  })

  it('runCli：非零結束算跑完了，結束代碼與兩股輸出原樣交出去（診斷 payload 要靠它分類）', async () => {
    const store = makeConfigStore(makeConfig({ openspecBin: '/custom/openspec' }))
    const shell = makeShell([
      { match: (p, a) => p === '/custom/openspec' && isVersionCall(p, a), outcome: ok('1.0.0') },
      { match: (p, a) => p === '/custom/openspec' && a[0] === 'list', outcome: nonZero('boom') },
    ])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { runCli } = await import('./cli')

    expect(await runCli(['list', '--json'], '/some/project'))
      .toEqual({ ok: true, exitCode: 1, stdout: '', stderr: 'boom' })
  })

  it('runCli：資料請求逾時歸呼叫失敗，訊息指出未於上限內結束', async () => {
    const store = makeConfigStore(makeConfig({ openspecBin: '/custom/openspec' }))
    const shell = makeShell([
      { match: (p, a) => p === '/custom/openspec' && isVersionCall(p, a), outcome: ok('1.0.0') },
      { match: (p, a) => p === '/custom/openspec' && a[0] === 'list', outcome: timedOut() },
    ])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { runCli } = await import('./cli')

    expect(await runCli(['list', '--json'], '/some/project')).toEqual({
      ok: false,
      failure: {
        kind: 'spawn-failed',
        message: `"/custom/openspec list --json" did not finish within ${DATA_LIMITS.timeoutMs}ms.`,
      },
    })
  })

  it('runCli：輸出被截斷歸呼叫失敗，半截的 stdout 不交給呼叫端解析', async () => {
    const store = makeConfigStore(makeConfig({ openspecBin: '/custom/openspec' }))
    const shell = makeShell([
      { match: (p, a) => p === '/custom/openspec' && isVersionCall(p, a), outcome: ok('1.0.0') },
      { match: (p, a) => p === '/custom/openspec' && a[0] === 'list', outcome: truncated('{"changes":[') },
    ])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { runCli } = await import('./cli')

    const result = await runCli(['list', '--json'], '/some/project')
    expect(result).toEqual({
      ok: false,
      failure: {
        kind: 'spawn-failed',
        message: `"/custom/openspec list --json" printed more than ${DATA_LIMITS.maxOutputBytes} bytes.`,
      },
    })
    expect(JSON.stringify(result)).not.toContain('{"changes":[')
  })

  it('runCli：外殼拒絕（執行檔不存在或不可執行）歸 CLI 不可用，訊息帶得出是哪個執行檔', async () => {
    const store = makeConfigStore(makeConfig({ openspecBin: '/custom/openspec' }))
    const shell = makeShell([
      { match: (p, a) => p === '/custom/openspec' && isVersionCall(p, a), outcome: ok('1.0.0') },
      { match: (p, a) => p === '/custom/openspec' && a[0] === 'list', outcome: fail('spawn ENOENT') },
    ])
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    const { runCli } = await import('./cli')

    expect(await runCli(['list', '--json'], '/some/project')).toEqual({
      ok: false,
      failure: { kind: 'cli-unavailable', message: 'Could not run "/custom/openspec": spawn ENOENT' },
    })
  })
})
