// @vitest-environment jsdom
import type { VueWrapper } from '@vue/test-utils'
import type { CliUpdateCheck, EnvironmentDiagnostics, WorkflowFilesEntry } from '../api'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useProjectsStore } from '../stores/projects'
import { useSettingsStore } from '../stores/settings'
import SettingsModal from './SettingsModal.vue'

const gateway = vi.hoisted(() => ({
  getCliSettings: vi.fn(),
  getDiagnostics: vi.fn(),
  checkCliUpdate: vi.fn(),
  listWorkflowFiles: vi.fn(),
  updateWorkflowFiles: vi.fn(),
}))

vi.mock('../api', () => ({ gateway }))

/**
 * 開啟位置的禁用成因由四種減為三種（本張的 5.3）。這裡只驗說明文字，
 * 不驗 `settings.reveal()` 本身怎麼呼叫外殼——那是 4.1／opener.test.ts 的範圍。
 */

const CONFIG_LABEL = 'Show config file in its folder'
const PROJECT_LABEL = 'Open current project folder'

const READY: EnvironmentDiagnostics = {
  configPath: '/config.json',
  projectPath: '/project',
  watching: true,
  appVersion: '0.0.0',
  canReveal: true,
}

// Settings modal 走 `<Teleport to="body">`：VTU 的 wrapper 只涵蓋掛載根，
// 遠端節點不在那棵子樹下，要查得用 document 直接找，並在每個案例結束後自己
// unmount——否則下個案例的節點會疊在 document.body 裡，選到的變成前一個案例的舊節點。
const mounted: VueWrapper[] = []

function openModal(diagnostics: EnvironmentDiagnostics | null) {
  setActivePinia(createPinia())
  const store = useSettingsStore()
  store.isOpen = true
  store.diagnostics = diagnostics
  const wrapper = mount(SettingsModal)
  mounted.push(wrapper)
  return { store, wrapper }
}

function hint(label: string) {
  const button = document.querySelector<HTMLElement>(`[aria-label="${label}"]`)
  if (!button)
    throw new Error(`not found: ${label}`)
  return { disabled: button.getAttribute('aria-disabled'), title: button.getAttribute('title') }
}

describe('settingsModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    for (const wrapper of mounted.splice(0))
      wrapper.unmount()
  })

  it('診斷還沒回來：兩個動作皆禁用，說明表明還在確認', () => {
    openModal(null)

    const config = hint(CONFIG_LABEL)
    const project = hint(PROJECT_LABEL)
    expect(config.disabled).toBe('true')
    expect(project.disabled).toBe('true')
    expect(config.title).toBe('Checking whether this app can show a file in its folder.')
    expect(project.title).toBe(config.title)
  })

  it('這個平台辦不到：動作禁用，說明表明平台不支援', () => {
    openModal({ ...READY, canReveal: false })

    const config = hint(CONFIG_LABEL)
    expect(config.disabled).toBe('true')
    expect(config.title).toBe('Showing a file in its folder is not available on this platform.')
  })

  it('能力可用但該項沒有路徑：動作禁用，說明表明這一項沒有可開的路徑', () => {
    openModal({ ...READY, projectPath: null })

    const project = hint(PROJECT_LABEL)
    expect(project.disabled).toBe('true')
    expect(project.title).toBe('There is no path to show for this item yet.')
  })

  it('桌面視窗形態下可用：兩個動作皆不呈現為禁用', () => {
    openModal(READY)

    const config = hint(CONFIG_LABEL)
    const project = hint(PROJECT_LABEL)
    expect(config.disabled).toBe('false')
    expect(project.disabled).toBe('false')
    expect(config.title).toBe('Show in Finder')
    expect(project.title).toBe('Open in Finder')
  })

  it('兩列的動作說明分得出來：title 與 aria-label 兩者皆彼此不同（design D6）', () => {
    openModal(READY)

    const config = document.querySelector<HTMLElement>(`[aria-label="${CONFIG_LABEL}"]`)!
    const project = document.querySelector<HTMLElement>(`[aria-label="${PROJECT_LABEL}"]`)!

    expect(config.getAttribute('aria-label')).not.toBe(project.getAttribute('aria-label'))
    expect(config.getAttribute('title')).not.toBe(project.getAttribute('title'))
    expect(config.getAttribute('title')).toBe('Show in Finder')
    expect(project.getAttribute('title')).toBe('Open in Finder')
  })

  it('按下設定檔那一列呼叫 reveal 帶入設定檔路徑，不是專案路徑——目標與型別標示不能對錯行', async () => {
    const { store } = openModal(READY)
    const revealSpy = vi.spyOn(store, 'reveal').mockResolvedValue()

    document.querySelector<HTMLButtonElement>(`[aria-label="${CONFIG_LABEL}"]`)!.click()

    expect(revealSpy).toHaveBeenCalledWith(READY.configPath)
    expect(revealSpy).not.toHaveBeenCalledWith(READY.projectPath)
  })

  it('按下目前專案那一列呼叫 reveal 帶入專案路徑，不是設定檔路徑——目標與型別標示不能對錯行', async () => {
    const { store } = openModal(READY)
    const revealSpy = vi.spyOn(store, 'reveal').mockResolvedValue()

    document.querySelector<HTMLButtonElement>(`[aria-label="${PROJECT_LABEL}"]`)!.click()

    expect(revealSpy).toHaveBeenCalledWith(READY.projectPath)
    expect(revealSpy).not.toHaveBeenCalledWith(READY.configPath)
  })

  it('禁用的開啟位置動作仍可被鍵盤聚焦——不是原生 disabled，MUST NOT 被踢出 tab 序列', () => {
    openModal(null)

    const button = document.querySelector<HTMLButtonElement>(`[aria-label="${CONFIG_LABEL}"]`)
    expect(button).not.toBeNull()
    expect(button!.disabled).toBe(false)
    expect(button!.hasAttribute('disabled')).toBe(false)
    // aria-disabled 是「看起來禁用」，原生 disabled 才會真的擋掉鍵盤聚焦；兩者不能混用
    expect(button!.getAttribute('aria-disabled')).toBe('true')
  })

  it('禁用原因同時掛在 aria-describedby 指向的說明上，不只在 title——輔助技術讀得到，不只指標停留能看到', () => {
    openModal(null)

    const button = document.querySelector<HTMLButtonElement>(`[aria-label="${CONFIG_LABEL}"]`)!
    const describedById = button.getAttribute('aria-describedby')
    expect(describedById).toBeTruthy()

    const description = document.getElementById(describedById!)
    expect(description).not.toBeNull()
    expect(description!.textContent).toBe('Checking whether this app can show a file in its folder.')
    expect(description!.textContent).toBe(button.getAttribute('title'))
  })

  it('可用時不掛 aria-describedby——沒有禁用原因可講，不留一個指向空說明的殘留關聯', () => {
    openModal(READY)

    const button = document.querySelector<HTMLButtonElement>(`[aria-label="${CONFIG_LABEL}"]`)!
    expect(button.hasAttribute('aria-describedby')).toBe(false)
  })

  it('開啟位置的禁用說明不佔用診斷區的條列，仍是四行', () => {
    openModal(READY)

    const rows = document.querySelectorAll('dl > div')
    expect(rows).toHaveLength(4)
  })

  it('三種禁用成因的說明彼此不同，且不再有第四種措辭', () => {
    // 三種成因逐一掛載、讀完立刻 unmount 再換下一個——否則三個 modal 疊在
    // document.body 裡，querySelector 只會挑到最早那個的節點
    openModal(null)
    const checking = hint(CONFIG_LABEL).title
    mounted.pop()!.unmount()

    openModal({ ...READY, canReveal: false })
    const unsupported = hint(CONFIG_LABEL).title
    mounted.pop()!.unmount()

    openModal({ ...READY, projectPath: null })
    const noPath = hint(PROJECT_LABEL).title
    mounted.pop()!.unmount()

    // 被移除的第四種措辭原文（見 SettingsModal.vue 對 main 的 diff 移除行）：
    // 'Showing a file in its folder is not available in the desktop app yet.'
    // 用它的獨有片語當查找字串——不是隨口挑的子字串，是真的會出現在舊措辭、
    // 不會出現在任何一句現行措辭裡的片段
    const reasons = [checking, unsupported, noPath]
    expect(new Set(reasons).size).toBe(3)
    for (const reason of reasons) {
      expect(reason).toBeDefined()
      expect(reason).not.toContain('desktop app yet')
    }
  })
  describe('更新檢查區塊', () => {
    function withCheck(patch: { checking?: boolean, check?: CliUpdateCheck | null }) {
      const { store } = openModal(READY)
      store.checkingUpdate = patch.checking ?? false
      store.updateCheck = patch.check ?? null
      return nextTick().then(() => document.querySelector<HTMLElement>('[data-testid="update-check"]'))
    }

    it('沒有結果也不在檢查：整塊不出現', async () => {
      expect(await withCheck({})).toBeNull()
    })

    it('檢查中', async () => {
      const el = await withCheck({ checking: true })
      expect(el?.textContent).toContain('Checking for updates')
    })

    it('有新版且附指令：顯示版號、指令與複製鈕', async () => {
      const el = await withCheck({ check: { status: 'available', latest: '1.15.0', command: 'pnpm add -g @fission-ai/openspec@latest' } })
      expect(el?.textContent).toContain('openspec 1.15.0 is available')
      expect(el?.textContent).toContain('pnpm add -g @fission-ai/openspec@latest')
      expect(el?.querySelector('[aria-label="Copy upgrade command"]')).not.toBeNull()
    })

    it('有新版但沒有指令：只有版號，沒有複製鈕', async () => {
      const el = await withCheck({ check: { status: 'available', latest: '1.15.0' } })
      expect(el?.textContent).toContain('openspec 1.15.0 is available')
      expect(el?.querySelector('button')).toBeNull()
      expect(el?.querySelector('code')).toBeNull()
    })

    it('已是最新版', async () => {
      const el = await withCheck({ check: { status: 'current' } })
      expect(el?.textContent).toContain('up to date')
    })

    it('無法檢查', async () => {
      const el = await withCheck({ check: { status: 'unavailable' } })
      expect(el?.textContent).toContain('Can\'t check for updates right now')
    })

    it('複製鈕複製的是升級指令本身，成功後換成 Copied、逾時復原', async () => {
      vi.useFakeTimers()
      try {
        const writeText = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
        const el = await withCheck({ check: { status: 'available', latest: '1.15.0', command: 'pnpm add -g @fission-ai/openspec@latest' } })
        const button = el!.querySelector<HTMLButtonElement>('[aria-label="Copy upgrade command"]')!
        expect(button.getAttribute('title')).toBe('Copy upgrade command')

        button.click()
        await vi.advanceTimersByTimeAsync(0)
        await nextTick()

        expect(writeText).toHaveBeenCalledWith('pnpm add -g @fission-ai/openspec@latest')
        expect(button.getAttribute('title')).toBe('Copied')

        await vi.advanceTimersByTimeAsync(2500)
        expect(button.getAttribute('title')).toBe('Copy upgrade command')
      }
      finally {
        vi.useRealTimers()
      }
    })

    it('結果就地呈現，不出 toast', async () => {
      await withCheck({ check: { status: 'unavailable' } })
      expect(document.querySelector('[data-testid="update-check"]')).not.toBeNull()
      expect(document.querySelector('[data-testid*="toast"], [role="alert"]')).toBeNull()
    })

    it('版本低於 1.14：說明需要 1.14 以上，沒有指令', async () => {
      const el = await withCheck({ check: { status: 'too-old' } })
      expect(el?.textContent).toContain('openspec 1.14 or later')
      expect(el?.querySelector('button')).toBeNull()
    })
  })

  describe('流程檔一覽區', () => {
    const entries: WorkflowFilesEntry[] = [
      { path: '/w/alpha', version: '1.13.1', status: 'behind' },
      { path: '/w/beta', version: '1.14.1', status: 'current' },
      { path: '/w/gamma', version: '1.15.0', status: 'ahead' },
      { path: '/w/delta', version: null, status: 'unset' },
      { path: '/w/epsilon', version: null, status: 'missing' },
      { path: '/w/zeta', version: '1.8.0', status: null },
    ]

    /** currentPath 為 null＝沒有目前專案；不在 list 裡＝暫時加入的目前專案 */
    function withEntries(list: WorkflowFilesEntry[] | null = entries, currentPath: string | null = '/w/alpha') {
      const ctx = openModal(READY)
      ctx.store.workflowFiles = list
      useProjectsStore().projects = (list ?? []).concat(currentPath && !list?.some(e => e.path === currentPath) ? [{ path: currentPath, version: null, status: null }] : []).map(e => ({
        path: e.path,
        name: e.path,
        current: e.path === currentPath,
        temporary: false,
        badge: null,
      }))
      return nextTick().then(() => ctx)
    }

    const toggle = () => document.querySelector<HTMLButtonElement>('[data-testid="workflow-others-toggle"]')!
    async function expand() {
      toggle().click()
      await nextTick()
    }

    const rows = () => [...document.querySelectorAll<HTMLElement>('[data-testid="workflow-row"]')]
    const updateButton = (name: string) => document.querySelector<HTMLButtonElement>(`[aria-label="Update ${name}"]`)

    it('六種列狀態各自呈現，只有落後列有 Update 按鈕', async () => {
      await withEntries()
      await expand()
      const text = rows().map(r => r.textContent!.replace(/\s+/g, ' ').trim())
      expect(text[0]).toContain('alpha')
      expect(text[0]).toContain('1.13.1')
      expect(text[0]).toContain('Behind CLI')
      expect(text[1]).toContain('Up to date')
      expect(text[2]).toContain('Newer than CLI')
      expect(text[3]).toContain('Not set up')
      // 沒有版本（未設定、資料夾不存在）顯示 "-"，不留空也不顯示 null
      for (const index of [3, 4]) {
        const cells = [...rows()[index]!.querySelectorAll('span')].map(span => span.textContent!.trim())
        expect(cells).toContain('-')
        expect(text[index]).not.toMatch(/null|undefined/)
      }
      // 有版本的列不顯示 "-"
      expect([...rows()[0]!.querySelectorAll('span')].map(span => span.textContent!.trim())).not.toContain('-')
      expect(text[4]).toContain('Folder not found')
      expect(text[5]).toContain('1.8.0')
      expect(text[5]).not.toMatch(/Behind|Up to date|Newer|Not set up|not found/)
      expect(document.querySelectorAll('[aria-label^="Update "]')).toHaveLength(1)
      expect(updateButton('alpha')).not.toBeNull()
    })

    it('沒有全部更新按鈕、沒有 git 資訊', async () => {
      await withEntries()
      await expand()
      const section = document.querySelector('[data-testid="workflow-files"]')!.textContent!
      expect(section).not.toMatch(/update all/i)
      expect(section).not.toMatch(/git|branch|uncommitted/i)
    })

    it('尚未讀到時顯示讀取中；整體失敗時顯示訊息；沒有專案時顯示空狀態', async () => {
      await withEntries(null)
      expect(document.querySelector('[data-testid="workflow-files"]')!.textContent).toContain('Reading project workflow files')
      mounted.pop()!.unmount()

      const { store } = await withEntries(null)
      store.workflowFilesError = 'nope'
      await nextTick()
      expect(document.querySelector('[data-testid="workflow-files"]')!.textContent).toContain('nope')
      mounted.pop()!.unmount()

      await withEntries([])
      expect(document.querySelector('[data-testid="workflow-files"]')!.textContent).toContain('No projects added yet')
    })

    it('按下 Update 帶入該專案路徑', async () => {
      const { store } = await withEntries()
      const spy = vi.spyOn(store, 'updateWorkflowFile').mockResolvedValue()
      updateButton('alpha')!.click()
      expect(spy).toHaveBeenCalledWith('/w/alpha')
    })

    it('更新中：按鈕禁用且標示忙碌，其他列照常', async () => {
      const { store } = await withEntries([
        { path: '/w/alpha', version: '1.13.1', status: 'behind' },
        { path: '/w/beta', version: '1.13.1', status: 'behind' },
      ])
      await expand()
      store.workflowOps['/w/alpha'] = { kind: 'updating' }
      await nextTick()
      const busy = updateButton('alpha')!
      expect(busy.disabled).toBe(true)
      expect(busy.getAttribute('aria-busy')).toBe('true')
      expect(busy.textContent).toContain('Updating')
      expect(updateButton('beta')!.disabled).toBe(false)
    })

    it('成功：列改為已是最新，按鈕消失，且不出 toast', async () => {
      const { store } = await withEntries()
      gateway.updateWorkflowFiles.mockResolvedValue({ ok: true })
      gateway.listWorkflowFiles.mockResolvedValue({
        ok: true,
        entries: entries.map(e => e.path === '/w/alpha' ? { ...e, version: '1.14.1', status: 'current' } : e),
      })
      updateButton('alpha')!.click()
      await vi.waitFor(() => expect(store.workflowOps['/w/alpha']?.kind).toBe('done'))
      await nextTick()
      expect(rows()[0]!.textContent).toContain('Up to date')
      expect(rows()[0]!.textContent).toContain('1.14.1')
      expect(updateButton('alpha')).toBeNull()
      expect(document.querySelector('[data-testid*="toast"], [role="alert"]')).toBeNull()
    })

    it('區塊位置在 openspec CLI 區塊之後、Environment 之前', async () => {
      await withEntries()
      const sections = [...document.querySelectorAll('section')]
      const idx = sections.findIndex(s => s.getAttribute('data-testid') === 'workflow-files')
      expect(idx).toBeGreaterThan(0)
      expect(sections[idx - 1]!.textContent).toMatch(/openspec/i)
      expect(sections[idx + 1]!.textContent).toContain('Environment')
    })

    it('4 列落後就只有 4 個各自的 Update 按鈕', async () => {
      await withEntries([
        { path: '/w/a', version: '1.13.1', status: 'behind' },
        { path: '/w/b', version: '1.13.1', status: 'behind' },
        { path: '/w/c', version: '1.2.0', status: 'behind' },
        { path: '/w/d', version: '1.8.0', status: 'behind' },
        { path: '/w/e', version: '1.14.1', status: 'current' },
        { path: '/w/f', version: null, status: 'unset' },
      ], '/w/e')
      await expand()
      const buttons = [...document.querySelectorAll('[data-testid="workflow-files"] [aria-label^="Update "]')]
      expect(buttons).toHaveLength(4)
      expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual(['Update a', 'Update b', 'Update c', 'Update d'])
    })

    it('cli 不可用（全部 status 為 null）：列出專案與版本，沒有狀態文字也沒有按鈕', async () => {
      await withEntries([
        { path: '/w/a', version: '1.13.1', status: null },
        { path: '/w/b', version: '1.14.1', status: null },
      ])
      await expand()
      expect(rows()).toHaveLength(2)
      expect(rows()[0]!.textContent).toContain('1.13.1')
      expect(rows()[1]!.textContent).toContain('1.14.1')
      expect(document.querySelector('[data-testid="workflow-files"] [aria-label^="Update "]')).toBeNull()
      expect(document.querySelector('[data-testid="workflow-files"]')!.textContent).not.toMatch(/Behind|Up to date|Newer|Update/)
    })

    it('實際點擊：更新中再點無效；另一列可同時更新，各自顯示結果', async () => {
      gateway.updateWorkflowFiles.mockReset()
      gateway.listWorkflowFiles.mockReset()
      const finish: Record<string, (v: unknown) => void> = {}
      gateway.updateWorkflowFiles.mockImplementation((path: string) => new Promise((r) => {
        finish[path] = r
      }))
      gateway.listWorkflowFiles.mockResolvedValue({
        ok: true,
        entries: [
          { path: '/w/alpha', version: '1.14.1', status: 'current' },
          { path: '/w/beta', version: '1.13.1', status: 'behind' },
        ],
      })
      const { store } = await withEntries([
        { path: '/w/alpha', version: '1.13.1', status: 'behind' },
        { path: '/w/beta', version: '1.13.1', status: 'behind' },
      ])
      await expand()
      updateButton('alpha')!.click()
      await nextTick()
      updateButton('alpha')!.click()
      expect(gateway.updateWorkflowFiles).toHaveBeenCalledTimes(1)
      updateButton('beta')!.click()
      await nextTick()
      expect(gateway.updateWorkflowFiles).toHaveBeenCalledTimes(2)
      expect(gateway.updateWorkflowFiles.mock.calls.map(c => c[0])).toEqual(['/w/alpha', '/w/beta'])

      finish['/w/beta']!({ ok: false, message: 'exit 2' })
      await vi.waitFor(() => expect(store.workflowOps['/w/beta']?.kind).toBe('failed'))
      finish['/w/alpha']!({ ok: true })
      await vi.waitFor(() => expect(store.workflowOps['/w/alpha']?.kind).toBe('done'))
      await nextTick()
      expect(rows()[0]!.textContent).toContain('Up to date')
      expect(updateButton('alpha')).toBeNull()
      expect(rows()[1]!.textContent).toContain('Update failed: exit 2')
      expect(updateButton('beta')!.disabled).toBe(false)
    })

    describe('目前專案置頂、其他專案收起', () => {
      const six: WorkflowFilesEntry[] = [
        { path: '/w/specrun-app', version: '1.13.1', status: 'behind' },
        { path: '/w/b', version: '1.13.1', status: 'behind' },
        { path: '/w/c', version: '1.2.0', status: 'behind' },
        { path: '/w/d', version: '1.8.0', status: 'behind' },
        { path: '/w/e', version: '1.14.1', status: 'current' },
        { path: '/w/f', version: null, status: 'unset' },
      ]
      const label = () => toggle().textContent!.replace(/\s+/g, ' ').trim()

      it('預設：最上方只有目前專案一列，其下一行顯示其餘數量與落後數，其餘各列未列出', async () => {
        await withEntries(six, '/w/specrun-app')
        expect(rows()).toHaveLength(1)
        expect(rows()[0]!.textContent).toContain('specrun-app')
        expect(rows()[0]!.textContent).toContain('Behind CLI')
        expect(label()).toBe('Other projects (5) · 3 behind')
        expect(toggle().getAttribute('aria-expanded')).toBe('false')
        expect(document.querySelector('[aria-label="Update b"]')).toBeNull()
      })

      it('點開：列出其餘 5 列，3 落後、1 最新、1 未設定；再點收起', async () => {
        await withEntries(six, '/w/specrun-app')
        await expand()
        expect(toggle().getAttribute('aria-expanded')).toBe('true')
        expect(document.getElementById(toggle().getAttribute('aria-controls')!)).not.toBeNull()
        const text = rows().map(r => r.textContent!)
        expect(text).toHaveLength(6)
        expect(text.slice(1).filter(t => t.includes('Behind CLI'))).toHaveLength(3)
        expect(text.slice(1).filter(t => t.includes('Up to date'))).toHaveLength(1)
        expect(text.slice(1).filter(t => t.includes('Not set up'))).toHaveLength(1)
        await expand()
        expect(rows()).toHaveLength(1)
        expect(toggle().getAttribute('aria-expanded')).toBe('false')
      })

      it('每次開啟 Settings 重新收起', async () => {
        gateway.getCliSettings.mockResolvedValue({ mode: 'auto', bin: 'openspec', version: '1.14.1', message: null })
        gateway.getDiagnostics.mockResolvedValue(READY)
        gateway.checkCliUpdate.mockResolvedValue({ status: 'current' })
        gateway.listWorkflowFiles.mockResolvedValue({ ok: true, entries: six })
        const { store } = await withEntries(six, '/w/specrun-app')
        await expand()
        expect(rows()).toHaveLength(6)
        store.close()
        await store.open()
        await vi.waitFor(() => expect(store.workflowFiles).not.toBeNull())
        await nextTick()
        expect(toggle().getAttribute('aria-expanded')).toBe('false')
        expect(rows()).toHaveLength(1)
      })

      it('沒有目前專案：最上方是一句說明，其他專案列出清單全部', async () => {
        await withEntries(six, null)
        expect(rows()).toHaveLength(0)
        expect(document.querySelector('[data-testid="workflow-no-current"]')!.textContent).toContain('isn\'t in your project list')
        expect(label()).toBe('Other projects (6) · 4 behind')
        await expand()
        expect(rows()).toHaveLength(6)
      })

      it('目前專案是暫時加入、不在清單：同樣以說明取代，清單全部列在其他專案', async () => {
        await withEntries(six, '/tmp/scratch')
        expect(document.querySelector('[data-testid="workflow-no-current"]')).not.toBeNull()
        expect(label()).toBe('Other projects (6) · 4 behind')
      })

      it('其他專案某列更新成功：該行落後數減 1', async () => {
        const { store } = await withEntries(six, '/w/specrun-app')
        await expand()
        gateway.updateWorkflowFiles.mockResolvedValue({ ok: true })
        gateway.listWorkflowFiles.mockResolvedValue({
          ok: true,
          entries: six.map(e => e.path === '/w/b' ? { ...e, version: '1.14.1', status: 'current' as const } : e),
        })
        updateButton('b')!.click()
        await vi.waitFor(() => expect(store.workflowOps['/w/b']?.kind).toBe('done'))
        await nextTick()
        expect(label()).toBe('Other projects (5) · 2 behind')
      })

      it('收起時更新中的列狀態保留，再展開仍顯示更新中', async () => {
        const { store } = await withEntries(six, '/w/specrun-app')
        await expand()
        store.workflowOps['/w/b'] = { kind: 'updating' }
        await expand()
        await expand()
        expect(updateButton('b')!.textContent).toContain('Updating')
      })

      it('展開按鈕可用鍵盤操作：是原生 button，且有 focus ring', async () => {
        await withEntries(six, '/w/specrun-app')
        expect(toggle().tagName).toBe('BUTTON')
        expect(toggle().getAttribute('type')).toBe('button')
        expect(toggle().className).toContain('kbd-focus')
      })
    })

    it('警告：就地顯示 CLI 給的警告文字', async () => {
      const { store } = await withEntries()
      store.workflowOps['/w/alpha'] = { kind: 'done', warning: 'Run with --force to clean up' }
      await nextTick()
      expect(rows()[0]!.textContent).toContain('Run with --force to clean up')
    })

    it('失敗：就地顯示訊息，Update 按鈕保留可再按', async () => {
      const { store } = await withEntries()
      store.workflowOps['/w/alpha'] = { kind: 'failed', message: 'exit code 1' }
      await nextTick()
      expect(rows()[0]!.textContent).toContain('Update failed: exit code 1')
      expect(updateButton('alpha')!.disabled).toBe(false)
    })
  })
  describe('焦點留在 modal 內（Tab 拉回）', () => {
    async function openedWithOutsideButton() {
      const outside = document.createElement('button')
      document.body.append(outside)
      const ctx = openModal(READY)
      // keydown 監聽在 isOpen 由關變開時才掛上，所以關了再開
      ctx.store.isOpen = false
      await nextTick()
      ctx.store.isOpen = true
      await nextTick()
      await nextTick()
      return { ...ctx, outside }
    }
    const focusables = () => [...document.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
    )].filter(el => el !== document.body && !!el.closest('[role="dialog"], [aria-modal="true"]'))

    it('焦點在 modal 外時：Tab 拉回第一項、Shift+Tab 拉回最後一項', async () => {
      const { outside } = await openedWithOutsideButton()
      const items = focusables()
      expect(items.length).toBeGreaterThan(1)

      outside.focus()
      expect(document.activeElement).toBe(outside)
      const forward = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
      window.dispatchEvent(forward)
      expect(forward.defaultPrevented).toBe(true)
      expect(document.activeElement).toBe(items[0])

      outside.focus()
      const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })
      window.dispatchEvent(backward)
      expect(backward.defaultPrevented).toBe(true)
      expect(document.activeElement).toBe(items.at(-1))
      outside.remove()
    })
  })
})
