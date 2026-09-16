import type { AppConfig } from '../app-config'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 桌面「目前是哪個專案」的接線層。不連真的 Tauri，改注入假的外殼通道
 * （vi.mock('./shell')）、假的 CLI 執行（vi.mock('./cli')）與假的設定檔持有處
 * （vi.mock('./config-store')）——驗的是這一層自己的規則：啟動優先序、
 * 加入／移除／切換的持久化與暫時項語意、清單組裝順序、徽章要不要帶。
 *
 * 每個測試都 resetModules 後重新 import，因為「目前專案」是模組層級的
 * 執行期單例，不重置會被前一個測試的狀態汙染。
 */

interface DirEntry {
  name: string
  isDirectory: boolean
  isFile: boolean
  isSymlink: boolean
}

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { projects: [], lastActivePath: null, openspecBin: null, ...overrides }
}

function makeConfigStore(initial: AppConfig) {
  const state = { ...initial }
  return { config: vi.fn(async () => state), persist: vi.fn(async () => {}), state }
}

function withOpenSpec(): DirEntry[] {
  return [{ name: 'openspec', isDirectory: true, isFile: false, isSymlink: false }]
}
function withoutOpenSpec(): DirEntry[] {
  return [{ name: 'README.md', isDirectory: false, isFile: true, isSymlink: false }]
}

function makeShell(dirs: Record<string, DirEntry[]> = {}) {
  return {
    // 對齊真實外殼：allow_dir_listing 先問 is_dir()，不是既存資料夾就回 false
    // 而且一次都沒放行（src-tauri/src/lib.rs）。假外殼若無條件回 true，「路徑
    // 不存在」會被放進下一關，測到的其實是別條分支。
    allowDirListing: vi.fn(async (path: string) => path in dirs),
    allowPath: vi.fn(async () => {}),
    resolveUserPath: vi.fn(async (input: string) => `/resolved${input}`),
    readDir: vi.fn(async (path: string) => {
      if (!(path in dirs))
        throw new Error('ENOENT')
      return dirs[path]!
    }),
  }
}

function makeCli(responses: Record<string, { ok: boolean, stdout: string }> = {}) {
  return {
    runCli: vi.fn(async (_args: string[], cwd: string) => responses[cwd] ?? { ok: false, stdout: '' }),
  }
}

describe('desktop/projects', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it('無最後啟用專案時進入空清單引導', async () => {
    const store = makeConfigStore(makeConfig())
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell())
    vi.doMock('./cli', () => makeCli())
    const { listProjects } = await import('./projects')

    expect(await listProjects()).toEqual({
      ok: true,
      snapshot: { projects: [], currentPath: null, badgesIncluded: true },
    })
  })

  it('設定檔有最後啟用專案時直接落在該專案，即使已不在持久化清單中（以暫時項置頂）', async () => {
    const store = makeConfigStore(makeConfig({ projects: ['/a'], lastActivePath: '/gone' }))
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell())
    vi.doMock('./cli', () => makeCli())
    const { listProjects } = await import('./projects')

    const result = await listProjects()
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.snapshot.currentPath).toBe('/gone')
    expect(result.snapshot.projects[0]).toMatchObject({ path: '/gone', current: true, temporary: true })
    expect(result.snapshot.projects[1]).toMatchObject({ path: '/a', current: false, temporary: false })
  })

  it('addProject：空白輸入拒絕，不寫入設定檔', async () => {
    const store = makeConfigStore(makeConfig())
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell())
    vi.doMock('./cli', () => makeCli())
    const { addProject } = await import('./projects')

    const result = await addProject('   ')
    expect(result).toEqual({ ok: false, message: 'Enter a project folder path.' })
    expect(store.persist).not.toHaveBeenCalled()
  })

  it('addProject：路徑不存在時拒絕，不寫入設定檔', async () => {
    const store = makeConfigStore(makeConfig())
    const shell = makeShell({})
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    vi.doMock('./cli', () => makeCli())
    const { addProject } = await import('./projects')

    const result = await addProject('/nope')
    expect(result).toEqual({ ok: false, message: 'That path is not an existing folder.' })
    // 擋在第一關：外殼答「這不是資料夾」就結束，不會再去讀目錄，也不放行整棵
    expect(shell.readDir).not.toHaveBeenCalled()
    expect(shell.allowPath).not.toHaveBeenCalled()
    expect(store.persist).not.toHaveBeenCalled()
  })

  it('addProject：資料夾在、但讀不動它的內容時，回報讀取失敗而不是「路徑不存在」', async () => {
    const store = makeConfigStore(makeConfig())
    // 外殼已答「是資料夾」，讀目錄才失敗——真實情形幾乎只剩權限不足。
    // 此時說「不是既存資料夾」會把人帶去查路徑，方向就指錯了。
    const shell = makeShell({})
    shell.allowDirListing = vi.fn(async () => true)
    shell.readDir = vi.fn(async () => {
      throw new Error('EACCES: permission denied')
    })
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    vi.doMock('./cli', () => makeCli())
    const { addProject } = await import('./projects')

    const result = await addProject('/locked')
    expect(result).toEqual({ ok: false, message: 'Could not read that folder. Check its permissions.' })
    // 三條錯誤路徑各自講各自的原因，句子不能互相撞：「不是資料夾」與
    // 「授權失敗」兩句都不該出現在這一條上
    if (!result.ok) {
      expect(result.message).not.toBe('That path is not an existing folder.')
      expect(result.message).not.toContain('Could not get access to that folder')
    }
    expect(shell.allowPath).not.toHaveBeenCalled()
    expect(store.persist).not.toHaveBeenCalled()
  })

  it('addProject：資料夾存在但無 openspec/ 目錄時拒絕', async () => {
    const store = makeConfigStore(makeConfig())
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell({ '/resolved/plain': withoutOpenSpec() }))
    vi.doMock('./cli', () => makeCli())
    const { addProject } = await import('./projects')

    const result = await addProject('/plain')
    expect(result).toEqual({ ok: false, message: 'That folder has no openspec/ directory.' })
    expect(store.persist).not.toHaveBeenCalled()
  })

  it('addProject：合法新專案加入即切換，並先授權該路徑', async () => {
    const store = makeConfigStore(makeConfig())
    const shell = makeShell({ '/resolved/proj': withOpenSpec() })
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    vi.doMock('./cli', () => makeCli())
    const { addProject } = await import('./projects')

    const result = await addProject('/proj')
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.alreadyExisted).toBe(false)
    expect(store.state.projects).toEqual(['/resolved/proj'])
    expect(store.state.lastActivePath).toBe('/resolved/proj')
    expect(store.persist).toHaveBeenCalled()
    expect(shell.allowPath).toHaveBeenCalledWith('/resolved/proj')
    expect(result.snapshot.currentPath).toBe('/resolved/proj')
  })

  it('addProject：allowDirListing 失敗時回報「無法取得授權」，跟「不是資料夾」是不同訊息，且不繼續往下驗證', async () => {
    const store = makeConfigStore(makeConfig())
    const shell = makeShell({ '/resolved/proj': withOpenSpec() })
    shell.allowDirListing = vi.fn(async () => {
      throw new Error('Operation not permitted')
    })
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    vi.doMock('./cli', () => makeCli())
    const { addProject } = await import('./projects')

    const result = await addProject('/proj')
    expect(result).toEqual({ ok: false, message: 'Could not get access to that folder: Operation not permitted' })
    expect(shell.readDir).not.toHaveBeenCalled()
    expect(shell.allowPath).not.toHaveBeenCalled()
    expect(store.persist).not.toHaveBeenCalled()
  })

  it('addProject：allowDirListing 回 false（貼進去的是檔案而不是資料夾）時回報「不是資料夾」，與上一個測試的授權失敗訊息分屬兩條路，且不繼續往下驗證', async () => {
    const store = makeConfigStore(makeConfig())
    // 目錄內容照樣備好：真讓它往下走就會加入成功，所以這個測試只有在 false
    // 真的被當成「擋下來」時才會綠。
    const shell = makeShell({ '/resolved/proj': withOpenSpec() })
    shell.allowDirListing = vi.fn(async () => false)
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    vi.doMock('./cli', () => makeCli())
    const { addProject } = await import('./projects')

    const result = await addProject('/proj')
    expect(result).toEqual({ ok: false, message: 'That path is not an existing folder.' })
    expect(shell.readDir).not.toHaveBeenCalled()
    // 最關鍵的一項：擋下來的路徑不能換來整棵資料夾的放行，fs scope 加了撤不回來
    expect(shell.allowPath).not.toHaveBeenCalled()
    expect(store.persist).not.toHaveBeenCalled()
  })

  it('addProject：allowPath 失敗時回報「無法取得授權」，不把專案留在清單裡（驗證已過但放行整棵失敗）', async () => {
    const store = makeConfigStore(makeConfig())
    const shell = makeShell({ '/resolved/proj': withOpenSpec() })
    shell.allowPath = vi.fn(async () => {
      throw new Error('EPERM')
    })
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    vi.doMock('./cli', () => makeCli())
    const { addProject } = await import('./projects')

    const result = await addProject('/proj')
    expect(result).toEqual({ ok: false, message: 'Could not get access to that folder: EPERM' })
    expect(store.persist).not.toHaveBeenCalled()
    expect(store.state.projects).toEqual([])
  })

  it('addProject：授權順序固定為 allowDirListing → 讀目錄驗證 → 驗證通過才 allowPath（不能先整棵放行）', async () => {
    const store = makeConfigStore(makeConfig())
    const shell = makeShell({ '/resolved/proj': withOpenSpec() })
    const originalReadDir = shell.readDir
    const calls: string[] = []
    shell.allowDirListing = vi.fn(async () => {
      calls.push('allowDirListing')
      return true
    })
    shell.readDir = vi.fn(async (path: string) => {
      calls.push('readDir')
      return originalReadDir(path)
    })
    shell.allowPath = vi.fn(async () => {
      calls.push('allowPath')
    })
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => shell)
    vi.doMock('./cli', () => makeCli())
    const { addProject } = await import('./projects')

    const result = await addProject('/proj')
    expect(result.ok).toBe(true)
    expect(calls).toEqual(['allowDirListing', 'readDir', 'allowPath'])
  })

  it('addProject：已在清單中則不重複加入，直接切過去', async () => {
    const store = makeConfigStore(makeConfig({ projects: ['/resolved/proj'], lastActivePath: '/other' }))
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell({ '/resolved/proj': withOpenSpec() }))
    vi.doMock('./cli', () => makeCli())
    const { addProject } = await import('./projects')

    const result = await addProject('/proj')
    expect(result.ok && result.alreadyExisted).toBe(true)
    expect(store.state.projects).toEqual(['/resolved/proj'])
  })

  it('removeProject：移除目前專案時接手清單第一個', async () => {
    const store = makeConfigStore(makeConfig({ projects: ['/a', '/b'], lastActivePath: '/a' }))
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell())
    vi.doMock('./cli', () => makeCli())
    const { removeProject } = await import('./projects')

    const result = await removeProject('/a')
    expect(result.ok).toBe(true)
    expect(store.state.projects).toEqual(['/b'])
    expect(store.state.lastActivePath).toBe('/b')
    if (result.ok)
      expect(result.snapshot.currentPath).toBe('/b')
  })

  it('removeProject：清空清單後進無目標專案狀態', async () => {
    const store = makeConfigStore(makeConfig({ projects: ['/a'], lastActivePath: '/a' }))
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell())
    vi.doMock('./cli', () => makeCli())
    const { removeProject } = await import('./projects')

    const result = await removeProject('/a')
    expect(store.state.projects).toEqual([])
    expect(store.state.lastActivePath).toBeNull()
    if (result.ok)
      expect(result.snapshot.currentPath).toBeNull()
  })

  it('switchProject：切到持久化清單中的專案並更新最後啟用', async () => {
    const store = makeConfigStore(makeConfig({ projects: ['/a', '/b'], lastActivePath: '/a' }))
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell())
    vi.doMock('./cli', () => makeCli())
    const { switchProject } = await import('./projects')

    const result = await switchProject('/b')
    expect(result.ok).toBe(true)
    expect(store.state.lastActivePath).toBe('/b')
    if (result.ok)
      expect(result.snapshot.currentPath).toBe('/b')
  })

  it('switchProject：暫時項可以再切一次確認，畫面仍標記為暫時項', async () => {
    const store = makeConfigStore(makeConfig({ projects: ['/a'], lastActivePath: '/temp-only' }))
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell())
    vi.doMock('./cli', () => makeCli())
    const { switchProject } = await import('./projects')

    const result = await switchProject('/temp-only')
    expect(result.ok).toBe(true)
    if (result.ok) {
      const entry = result.snapshot.projects.find(each => each.path === '/temp-only')
      expect(entry).toMatchObject({ current: true, temporary: true })
    }
  })

  it('switchProject：目標不在清單中，且不是目前的暫時項時拒絕', async () => {
    const store = makeConfigStore(makeConfig({ projects: ['/a'], lastActivePath: '/a' }))
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell())
    vi.doMock('./cli', () => makeCli())
    const { switchProject } = await import('./projects')

    const result = await switchProject('/unknown')
    expect(result).toEqual({ ok: false, message: 'That project is not in the list.' })
  })

  it('清單端點會帶徽章數；implicit root（非 openspec 專案）視為沒有專案不編數字', async () => {
    const store = makeConfigStore(makeConfig({ projects: ['/a', '/b'], lastActivePath: '/a' }))
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell())
    vi.doMock('./cli', () => makeCli({
      '/a': { ok: true, stdout: JSON.stringify({ changes: [{ name: 'x' }, { name: 'y' }] }) },
      '/b': { ok: true, stdout: JSON.stringify({ changes: [], root: { source: 'implicit' } }) },
    }))
    const { listProjects } = await import('./projects')

    const result = await listProjects()
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    const badgeOf = (path: string) => result.snapshot.projects.find(each => each.path === path)?.badge
    expect(badgeOf('/a')).toBe(2)
    expect(badgeOf('/b')).toBeNull()
  })

  it('加入／切換／移除不帶徽章：badgesIncluded 為 false 且完全不呼叫 CLI', async () => {
    const store = makeConfigStore(makeConfig({ projects: ['/resolved/proj'], lastActivePath: '/resolved/proj' }))
    const cli = makeCli({ '/resolved/proj': { ok: true, stdout: JSON.stringify({ changes: [{ name: 'x' }] }) } })
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell())
    vi.doMock('./cli', () => cli)
    const { switchProject } = await import('./projects')

    const result = await switchProject('/resolved/proj')
    expect(result.ok && result.snapshot.badgesIncluded).toBe(false)
    expect(cli.runCli).not.toHaveBeenCalled()
  })

  it('過渡：切換成功後通知本地 API server 的切換掛載點', async () => {
    const store = makeConfigStore(makeConfig({ projects: ['/resolved/proj'], lastActivePath: '/other' }))
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}'))
    vi.stubGlobal('fetch', fetchSpy)
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell())
    vi.doMock('./cli', () => makeCli())
    const { switchProject } = await import('./projects')

    expect((await switchProject('/resolved/proj')).ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('/api/project/switch')
    expect(init?.body).toBe(JSON.stringify({ path: '/resolved/proj', skipConfigWrite: true }))
  })

  it('過渡：通知失敗不讓切換失敗', async () => {
    const store = makeConfigStore(makeConfig({ projects: ['/resolved/proj'], lastActivePath: '/other' }))
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('server not running')
    }))
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell())
    vi.doMock('./cli', () => makeCli())
    const { switchProject } = await import('./projects')

    const result = await switchProject('/resolved/proj')
    expect(result.ok).toBe(true)
    expect(store.state.lastActivePath).toBe('/resolved/proj')
  })

  it('過渡：加入成功後通知本地 API server（不只切換要驗，加入也要）', async () => {
    const store = makeConfigStore(makeConfig())
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}'))
    vi.stubGlobal('fetch', fetchSpy)
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell({ '/resolved/proj': withOpenSpec() }))
    vi.doMock('./cli', () => makeCli())
    const { addProject } = await import('./projects')

    expect((await addProject('/proj')).ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('/api/project/switch')
    expect(init?.body).toBe(JSON.stringify({ path: '/resolved/proj', skipConfigWrite: true }))
  })

  it('過渡：加入時已在清單中一樣切過去，也要通知本地 API server', async () => {
    const store = makeConfigStore(makeConfig({ projects: ['/resolved/proj'], lastActivePath: '/other' }))
    const fetchSpy = vi.fn(async () => new Response('{}'))
    vi.stubGlobal('fetch', fetchSpy)
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell({ '/resolved/proj': withOpenSpec() }))
    vi.doMock('./cli', () => makeCli())
    const { addProject } = await import('./projects')

    const result = await addProject('/proj')
    expect(result.ok && result.alreadyExisted).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('過渡：加入時通知失敗不讓加入失敗', async () => {
    const store = makeConfigStore(makeConfig())
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('server not running')
    }))
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell({ '/resolved/proj': withOpenSpec() }))
    vi.doMock('./cli', () => makeCli())
    const { addProject } = await import('./projects')

    const result = await addProject('/proj')
    expect(result.ok).toBe(true)
    expect(store.state.projects).toEqual(['/resolved/proj'])
  })

  it('過渡：移除後仍有目前專案時通知本地 API server，帶新的目前專案路徑', async () => {
    const store = makeConfigStore(makeConfig({ projects: ['/a', '/b'], lastActivePath: '/a' }))
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}'))
    vi.stubGlobal('fetch', fetchSpy)
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell())
    vi.doMock('./cli', () => makeCli())
    const { removeProject } = await import('./projects')

    expect((await removeProject('/a')).ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('/api/project/switch')
    expect(init?.body).toBe(JSON.stringify({ path: '/b', skipConfigWrite: true }))
  })

  it('過渡：移除到清空清單時，目前專案為 null，不呼叫本地 API server', async () => {
    const store = makeConfigStore(makeConfig({ projects: ['/a'], lastActivePath: '/a' }))
    const fetchSpy = vi.fn(async () => new Response('{}'))
    vi.stubGlobal('fetch', fetchSpy)
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell())
    vi.doMock('./cli', () => makeCli())
    const { removeProject } = await import('./projects')

    const result = await removeProject('/a')
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.snapshot.currentPath).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('過渡：加入／切換／移除三個掛載點都獨立帶上 skipConfigWrite: true（不是照抄 production 字面、而是各自解析 body 驗證這一個欄位本身），伺服端才不會把桌面端剛寫的設定蓋掉', async () => {
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}'))
    vi.stubGlobal('fetch', fetchSpy)

    const addStore = makeConfigStore(makeConfig())
    vi.doMock('./config-store', () => addStore)
    vi.doMock('./shell', () => makeShell({ '/resolved/proj': withOpenSpec() }))
    vi.doMock('./cli', () => makeCli())
    const { addProject } = await import('./projects')
    await addProject('/proj')

    vi.resetModules()
    const switchStore = makeConfigStore(makeConfig({ projects: ['/a', '/b'], lastActivePath: '/a' }))
    vi.doMock('./config-store', () => switchStore)
    vi.doMock('./shell', () => makeShell())
    vi.doMock('./cli', () => makeCli())
    const { switchProject } = await import('./projects')
    await switchProject('/b')

    vi.resetModules()
    const removeStore = makeConfigStore(makeConfig({ projects: ['/a', '/b'], lastActivePath: '/a' }))
    vi.doMock('./config-store', () => removeStore)
    vi.doMock('./shell', () => makeShell())
    vi.doMock('./cli', () => makeCli())
    const { removeProject } = await import('./projects')
    await removeProject('/a')

    expect(fetchSpy).toHaveBeenCalledTimes(3)
    for (const call of fetchSpy.mock.calls) {
      const init = call[1] as RequestInit
      const body = JSON.parse(init.body as string) as { skipConfigWrite?: unknown }
      expect(body.skipConfigWrite).toBe(true)
    }
  })

  it('過渡：移除時通知失敗不讓移除失敗', async () => {
    const store = makeConfigStore(makeConfig({ projects: ['/a', '/b'], lastActivePath: '/a' }))
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('server not running')
    }))
    vi.doMock('./config-store', () => store)
    vi.doMock('./shell', () => makeShell())
    vi.doMock('./cli', () => makeCli())
    const { removeProject } = await import('./projects')

    const result = await removeProject('/a')
    expect(result.ok).toBe(true)
    expect(store.state.projects).toEqual(['/b'])
  })
})
