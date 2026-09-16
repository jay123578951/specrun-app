import type { AppConfig } from './app-config'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * switchProject 的 `skipConfigWrite`：桌面形態的切換掛載點呼叫這一趟時，只借它
 * 更新執行期狀態（目前專案、供 watcher 換掛判斷），不能連帶整檔寫回設定檔——那個
 * 行程手上的設定是啟動時讀進去的，整檔寫回會把桌面端剛寫的 CLI 路徑與專案清單蓋成
 * 舊值。同理，帶這一欄時成員資格要以磁碟那一份為準，不能拿啟動時的舊清單否決掉
 * 桌面端剛加入的專案。不帶這一欄的呼叫端（web 形態）行為要與先前完全相同：照樣
 * 重讀不做、照樣落盤。
 *
 * 不連真的檔案系統：mock `./app-config` 的 readConfig／writeConfig，只留
 * switchProject 自己的規則可測（是否呼叫 writeConfig、寫入的內容是什麼）。
 * 每個測試都 resetModules 後重新 import，因為「目前專案」是模組層級的
 * 執行期單例；同時把 `SPECRUN_PROJECT_PATH` 清空，避免 initState() 的
 * env 優先序分支被跑測試的環境汙染。
 */

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return { projects: [], lastActivePath: null, openspecBin: null, ...overrides }
}

function makeAppConfigModule(initial: AppConfig) {
  const state = { ...initial }
  // 磁碟上那一份。預設就是本行程啟動時讀到的同一個物件；測試呼叫 writeDisk 換掉它，
  // 即可重現「外殼那一側在本行程啟動之後才寫進去的內容」——本行程手上的快照不會
  // 自己對齊，這正是 skipConfigWrite 那條路徑要面對的處境。
  let disk: AppConfig = state
  return {
    readConfig: vi.fn(async () => disk),
    writeConfig: vi.fn(async (_config: AppConfig) => {}),
    expandHome: vi.fn((input: string) => input),
    state,
    writeDisk(next: AppConfig) {
      disk = next
    },
  }
}

describe('project-state — switchProject 的 skipConfigWrite', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('SPECRUN_PROJECT_PATH', '')
  })

  it('帶 skipConfigWrite: true 時只更新執行期狀態，完全不呼叫 writeConfig', async () => {
    const appConfig = makeAppConfigModule(makeConfig({ projects: ['/a', '/b'], lastActivePath: '/a' }))
    vi.doMock('./app-config', () => appConfig)
    const { switchProject, currentProjectPath } = await import('./project-state')

    const result = await switchProject('/b', { skipConfigWrite: true })

    expect(result).toEqual({ ok: true, path: '/b' })
    expect(await currentProjectPath()).toBe('/b')
    expect(appConfig.writeConfig).not.toHaveBeenCalled()
  })

  it('不帶旗標時照舊寫入設定檔——行為與 skipConfigWrite 加入之前完全相同', async () => {
    const appConfig = makeAppConfigModule(makeConfig({ projects: ['/a', '/b'], lastActivePath: '/a' }))
    vi.doMock('./app-config', () => appConfig)
    const { switchProject } = await import('./project-state')

    const result = await switchProject('/b')

    expect(result).toEqual({ ok: true, path: '/b' })
    expect(appConfig.writeConfig).toHaveBeenCalledTimes(1)
    expect(appConfig.state.lastActivePath).toBe('/b')
  })

  it('帶旗標時成員資格以磁碟那份為準：本行程啟動時的清單沒有該路徑，仍切換成功', async () => {
    const appConfig = makeAppConfigModule(makeConfig({ projects: ['/a'], lastActivePath: '/a' }))
    vi.doMock('./app-config', () => appConfig)
    const { switchProject, currentProjectPath } = await import('./project-state')

    // 先讓本行程把舊清單（只有 /a）讀進來當快照
    expect(await currentProjectPath()).toBe('/a')
    // 桌面端加入 /b 並自己寫進設定檔；本行程手上那份快照仍停在只有 /a
    appConfig.writeDisk(makeConfig({ projects: ['/a', '/b'], lastActivePath: '/b' }))

    const result = await switchProject('/b', { skipConfigWrite: true })

    // 拿舊快照否決的話，這裡會是 ok: false，畫面就會變成側欄標 /b、主區還列 /a
    expect(result).toEqual({ ok: true, path: '/b' })
    expect(await currentProjectPath()).toBe('/b')
    expect(appConfig.writeConfig).not.toHaveBeenCalled()
  })

  it('不帶旗標時不重讀設定檔：判定只看本行程手上那份快照，web 形態行為逐字不變', async () => {
    const appConfig = makeAppConfigModule(makeConfig({ projects: ['/a'], lastActivePath: '/a' }))
    vi.doMock('./app-config', () => appConfig)
    const { switchProject, currentProjectPath } = await import('./project-state')

    expect(await currentProjectPath()).toBe('/a')
    const readsAfterStartup = appConfig.readConfig.mock.calls.length
    appConfig.writeDisk(makeConfig({ projects: ['/a', '/b'], lastActivePath: '/b' }))

    const result = await switchProject('/b')

    // 磁碟上有 /b 也不算數——web 形態的寫入權在自己手上，重讀反而會吃到別人的中間狀態
    expect(result).toEqual({ ok: false, message: 'That project is not in the list.' })
    expect(appConfig.readConfig).toHaveBeenCalledTimes(readsAfterStartup)
  })

  it('先 skipConfigWrite 更新執行期狀態、後一趟不帶旗標的呼叫才落盤，且落盤內容反映最新狀態（證明前一趟真的沒寫）', async () => {
    const appConfig = makeAppConfigModule(makeConfig({ projects: ['/a', '/b', '/c'], lastActivePath: '/a' }))
    vi.doMock('./app-config', () => appConfig)
    const { switchProject } = await import('./project-state')

    await switchProject('/b', { skipConfigWrite: true })
    expect(appConfig.writeConfig).not.toHaveBeenCalled()

    await switchProject('/c')
    expect(appConfig.writeConfig).toHaveBeenCalledTimes(1)
    const [written] = appConfig.writeConfig.mock.calls[0] as [AppConfig]
    expect(written.lastActivePath).toBe('/c')
  })
})
