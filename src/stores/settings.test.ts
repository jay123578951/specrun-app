import type { CliSettings } from '../api'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useArchivedStore } from './archived'
import { useChangesStore } from './changes'
import { useSettingsStore } from './settings'
import { useSpecsStore } from './specs'
import { useViewStore } from './view'

const gateway = vi.hoisted(() => ({
  getCliSettings: vi.fn(),
  applyCliPath: vi.fn(),
  redetectCli: vi.fn(),
  getDiagnostics: vi.fn(),
  revealPath: vi.fn(),
  listChanges: vi.fn(),
  listParked: vi.fn(),
  listProjects: vi.fn(),
  listSpecs: vi.fn(),
  listArchived: vi.fn(),
}))

vi.mock('../api', () => ({ gateway }))

const AUTO_OK: CliSettings = { mode: 'auto', bin: 'openspec', version: '1.8.2', message: null }
const OVERRIDE_OK: CliSettings = {
  mode: 'override',
  bin: '/Users/me/Library/pnpm/openspec',
  version: '1.8.2',
  message: null,
}

function serverIsQuiet(): void {
  gateway.listChanges.mockResolvedValue({ ok: true, targetPath: '/p', changes: [] })
  gateway.listParked.mockResolvedValue({ ok: true, parkAvailable: true, items: [] })
  gateway.listProjects.mockResolvedValue({
    ok: true,
    snapshot: { projects: [], currentPath: '/p', badgesIncluded: true },
  })
  gateway.listSpecs.mockResolvedValue({ ok: true, targetPath: '/p', specs: [] })
  gateway.listArchived.mockResolvedValue({ ok: true, targetPath: '/p', items: [] })
  gateway.getDiagnostics.mockResolvedValue({
    configPath: '/config.json',
    projectPath: '/p',
    watching: true,
    appVersion: '0.0.0',
    canReveal: true,
  })
}

/** 開著 Settings、目前生效的是自動偵測到的執行檔——各案例的共同起點 */
async function opened() {
  const store = useSettingsStore()
  gateway.getCliSettings.mockResolvedValue(AUTO_OK)
  await store.open()
  return store
}

describe('settings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    serverIsQuiet()
  })

  it('驗證失敗不寫入、不重載，且目前生效的解析結果不變', async () => {
    const store = await opened()
    gateway.applyCliPath.mockResolvedValue({ ok: false, message: '"/gone" does not exist.' })

    store.useManual()
    store.setDraft('/gone')
    await store.apply()

    expect(store.settings).toEqual(AUTO_OK)
    expect(store.status).toEqual({ kind: 'failed', message: '"/gone" does not exist.' })
    expect(gateway.listChanges).not.toHaveBeenCalled()
    expect(gateway.listProjects).not.toHaveBeenCalled()
  })

  it('套用成功後重載 change 清單與徽章，modal 維持開啟且狀態列留成功態', async () => {
    const store = await opened()
    gateway.applyCliPath.mockResolvedValue({ ok: true, settings: OVERRIDE_OK })

    store.useManual()
    store.setDraft('/Users/me/Library/pnpm/openspec')
    await store.apply()

    expect(gateway.listChanges).toHaveBeenCalledTimes(1)
    expect(gateway.listProjects).toHaveBeenCalledTimes(1)
    expect(store.isOpen).toBe(true)
    expect(store.mode).toBe('override')
    expect(store.status).toEqual({
      kind: 'ok',
      bin: '/Users/me/Library/pnpm/openspec',
      version: '1.8.2',
    })
  })

  it('archived 不因換 CLI 而重載（檔案層直讀、CLI 零參與）', async () => {
    const store = await opened()
    useArchivedStore()
    gateway.applyCliPath.mockResolvedValue({ ok: true, settings: OVERRIDE_OK })

    store.useManual()
    store.setDraft('/Users/me/Library/pnpm/openspec')
    await store.apply()

    expect(gateway.listArchived).not.toHaveBeenCalled()
  })

  it('目前頁為 Changes 時不另外重載 specs', async () => {
    const store = await opened()
    gateway.applyCliPath.mockResolvedValue({ ok: true, settings: OVERRIDE_OK })

    store.useManual()
    store.setDraft('/x/openspec')
    await store.apply()

    expect(gateway.listSpecs).not.toHaveBeenCalled()
  })

  it('目前頁為 Specs 時一併重載該頁的引擎資料', async () => {
    const store = await opened()
    useViewStore().show('specs')
    useSpecsStore()
    gateway.applyCliPath.mockResolvedValue({ ok: true, settings: OVERRIDE_OK })

    store.useManual()
    store.setDraft('/x/openspec')
    await store.apply()

    expect(gateway.listSpecs).toHaveBeenCalledTimes(1)
  })

  it('草稿與生效中的執行檔不同時退回「尚未驗證」，不沿用上一次的成功態', async () => {
    const store = await opened()

    store.useManual()
    expect(store.status).toEqual({ kind: 'unverified' })

    store.setDraft('/x/openspec')
    expect(store.status).toEqual({ kind: 'unverified' })
  })

  it('編輯草稿撤下上一次的失敗訊息', async () => {
    const store = await opened()
    gateway.applyCliPath.mockResolvedValue({ ok: false, message: 'nope' })

    store.useManual()
    store.setDraft('/gone')
    await store.apply()
    expect(store.status.kind).toBe('failed')

    store.setDraft('/gone2')
    expect(store.status).toEqual({ kind: 'unverified' })
  })

  it('切回自動偵測會重跑解析並比照套用成功後重載', async () => {
    const store = await opened()
    store.useManual()
    gateway.redetectCli.mockResolvedValue(AUTO_OK)

    await store.useAuto()

    expect(gateway.redetectCli).toHaveBeenCalledTimes(1)
    expect(store.mode).toBe('auto')
    expect(gateway.listChanges).toHaveBeenCalledTimes(1)
    expect(gateway.listArchived).not.toHaveBeenCalled()
  })

  it('reveal 成功時不顯示任何提示', async () => {
    const store = await opened()
    gateway.revealPath.mockResolvedValue({ status: 'revealed' })

    await store.reveal('/p')

    expect(useChangesStore().toasts).toHaveLength(0)
  })

  it('reveal 失敗顯示「Could not open that location.」，不再提 enclosing folder', async () => {
    const store = await opened()
    gateway.revealPath.mockResolvedValue({ status: 'failed' })

    await store.reveal('/p')

    const toasts = useChangesStore().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0]!.message).toBe('Could not open that location.')
  })

  it('reveal 在此平台不支援時顯示不提 enclosing folder 的說明', async () => {
    const store = await opened()
    gateway.revealPath.mockResolvedValue({ status: 'unsupported' })

    await store.reveal('/p')

    const toasts = useChangesStore().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0]!.message).toBe('Opening that location is not available on this platform.')
  })

  it('晚到的舊回應不得寫回狀態', async () => {
    const store = await opened()
    let settle!: (value: { ok: true, settings: CliSettings }) => void
    gateway.applyCliPath.mockReturnValue(new Promise((resolve) => {
      settle = resolve
    }))

    store.useManual()
    store.setDraft('/slow/openspec')
    const inFlight = store.apply()

    // 套用還在飛時重新開啟 modal：refresh() 搶號，那次套用的結果就此作廢
    gateway.getCliSettings.mockResolvedValue(AUTO_OK)
    await store.open()

    settle({ ok: true, settings: OVERRIDE_OK })
    await inFlight

    expect(store.settings).toEqual(AUTO_OK)
    expect(gateway.listChanges).not.toHaveBeenCalled()
  })
})
