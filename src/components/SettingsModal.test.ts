// @vitest-environment jsdom
import type { VueWrapper } from '@vue/test-utils'
import type { EnvironmentDiagnostics } from '../api'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '../stores/settings'
import SettingsModal from './SettingsModal.vue'

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
})
