// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderMarkdown } from '../markdown/render'
import { useChangesStore } from '../stores/changes'
import MarkdownView from './MarkdownView.vue'

/**
 * `renderMarkdown` 首次呼叫要動態載入 shiki 的主題與語言檔（真的 import()，經真實
 * 檔案系統，不是純 microtask 鏈），時間不可預期；`getHighlighter()` 的結果是模組層
 * 快取，先在這裡暖機一次，後面每個案例的 render 就只剩快取命中＋同步 render，
 * 一輪 microtask 就會落地，不必猜要等幾輪。
 */
beforeAll(async () => {
  await renderMarkdown('warmup', { interactive: false })
})

/** 暖機後 render 只剩快取命中＋同步工作，一輪 microtask 排空即落地 */
async function waitForRender(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve))
}

const gateway = vi.hoisted(() => ({
  openUrl: vi.fn(),
}))

vi.mock('../api', () => ({ gateway }))

const EXTERNAL_LINK_SOURCE = '[link](https://example.com)'
const RELATIVE_LINK_SOURCE = '[relative](./design.md)'
/**
 * render.ts 的 `applyLinkPolicy` 判斷可不可點用的是 `/^(?:https?:|mailto:)/i`，帶 `/i`，
 * 所以這兩則大寫／混合大小寫 scheme 一樣會被畫成可點的 `<a>`，走進 `onClick` 的連結分支。
 * `normalizeAllowedUrl` 要在交給 `gateway.openUrl` 之前把 scheme 正規化成小寫——這裡
 * 驗的正是這一步的實質內容，不只是「有被呼叫」。
 */
const UPPERCASE_SCHEME_SOURCE = '[link](HTTPS://example.com)'
const MIXED_CASE_MAILTO_SOURCE = '[email](MailTo:person@example.com)'
/** scheme 以外的部分不該被動到——只驗「整段被小寫」的錯誤修法會被這條抓到 */
const UPPERCASE_SCHEME_MIXED_PATH_SOURCE = '[link](HTTPS://Example.com/PATH)'
/**
 * tel: 沒被 markdown-it 內建的 BAD_PROTO_RE 擋下（那份清單只有
 * vbscript／javascript／file／data），會真的流到 render.ts 的 `applyLinkPolicy`——
 * 用它才驗得到「入口守衛在 render.ts、畫面端不重複判斷 scheme」這件事本身，
 * 不是被 markdown-it 自己的黑名單代勞。
 */
const TEL_SCHEME_SOURCE = '[call](tel:+123456789)'
/**
 * file: 與 javascript: 是 spec scenario 原文點名的兩個例子，但兩者都命中
 * markdown-it 內建的 BAD_PROTO_RE，在到達 `applyLinkPolicy` 之前就已經連
 * link token 都沒有解析出來——輸出是未解析的原始方括號文字，不是
 * `.md-link-inert`。這裡只驗 spec 真正要求的底線（不出現 `<a>`、點擊不呼叫
 * 資料入口），不斷言 `.md-link-inert`（那個 class 在這兩個 scheme 上不會出現）。
 */
const FILE_SCHEME_SOURCE = '[local](file:///etc/passwd)'
const JS_SCHEME_SOURCE = '[hack](javascript:alert(1))'

describe('markdownView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    gateway.openUrl.mockReset()
    gateway.openUrl.mockResolvedValue({ status: 'opened' })
  })

  it('可勾選模式下點擊外部連結呼叫資料入口一次', async () => {
    const wrapper = mount(MarkdownView, { props: { source: EXTERNAL_LINK_SOURCE, interactive: true } })
    await waitForRender()

    await wrapper.find('a[href="https://example.com"]').trigger('click')

    expect(gateway.openUrl).toHaveBeenCalledTimes(1)
    expect(gateway.openUrl).toHaveBeenCalledWith('https://example.com')
  })

  it('唯讀模式下點擊外部連結呼叫資料入口一次', async () => {
    // 不帶 interactive：Specs 全文、已歸檔詳情都是這個形狀——那道守衛
    // 曾經整段退出，連結因此點不動，是 design Risks 明列的最高風險項
    const wrapper = mount(MarkdownView, { props: { source: EXTERNAL_LINK_SOURCE } })
    await waitForRender()

    await wrapper.find('a[href="https://example.com"]').trigger('click')

    expect(gateway.openUrl).toHaveBeenCalledTimes(1)
    expect(gateway.openUrl).toHaveBeenCalledWith('https://example.com')
  })

  it('pending 模式下點擊外部連結呼叫資料入口一次', async () => {
    const wrapper = mount(MarkdownView, {
      props: { source: EXTERNAL_LINK_SOURCE, interactive: true, pendingLines: [0] },
    })
    await waitForRender()

    await wrapper.find('a[href="https://example.com"]').trigger('click')

    expect(gateway.openUrl).toHaveBeenCalledTimes(1)
    expect(gateway.openUrl).toHaveBeenCalledWith('https://example.com')
  })

  it('按著 Cmd 點擊外部連結行為與一般點擊相同（design D2：不看修飾鍵）', async () => {
    const wrapper = mount(MarkdownView, { props: { source: EXTERNAL_LINK_SOURCE } })
    await waitForRender()

    await wrapper.find('a[href="https://example.com"]').trigger('click', { metaKey: true })

    expect(gateway.openUrl).toHaveBeenCalledTimes(1)
    expect(gateway.openUrl).toHaveBeenCalledWith('https://example.com')
  })

  it('大寫 scheme（HTTPS://）點擊後送進資料入口的字串 scheme 已正規化為小寫', async () => {
    const wrapper = mount(MarkdownView, { props: { source: UPPERCASE_SCHEME_SOURCE } })
    await waitForRender()

    await wrapper.find('a[href="HTTPS://example.com"]').trigger('click')

    expect(gateway.openUrl).toHaveBeenCalledTimes(1)
    expect(gateway.openUrl).toHaveBeenCalledWith('https://example.com')
  })

  it('混合大小寫 scheme（MailTo:）點擊後送進資料入口的字串 scheme 已正規化為小寫', async () => {
    const wrapper = mount(MarkdownView, { props: { source: MIXED_CASE_MAILTO_SOURCE } })
    await waitForRender()

    await wrapper.find('a[href="MailTo:person@example.com"]').trigger('click')

    expect(gateway.openUrl).toHaveBeenCalledTimes(1)
    expect(gateway.openUrl).toHaveBeenCalledWith('mailto:person@example.com')
  })

  it('正規化只動 scheme 那一段，網址其餘部分的大小寫原樣送出', async () => {
    const wrapper = mount(MarkdownView, { props: { source: UPPERCASE_SCHEME_MIXED_PATH_SOURCE } })
    await waitForRender()

    await wrapper.find('a[href="HTTPS://Example.com/PATH"]').trigger('click')

    expect(gateway.openUrl).toHaveBeenCalledWith('https://Example.com/PATH')
  })

  it('小寫 scheme 維持恆等，不因正規化而改變送出的字串（回歸保護）', async () => {
    const wrapper = mount(MarkdownView, { props: { source: EXTERNAL_LINK_SOURCE } })
    await waitForRender()

    await wrapper.find('a[href="https://example.com"]').trigger('click')

    expect(gateway.openUrl).toHaveBeenCalledWith('https://example.com')
  })

  it('正規化後 scheme 仍不在允許清單內時不呼叫資料入口（normalizeAllowedUrl 自己的防禦層）', async () => {
    // render.ts 的 applyLinkPolicy 保證正常渲染路徑不會產生允許清單以外 scheme 的 <a>
    // （tel:／file:／javascript: 已經測過會被畫成 span，不會走到這裡）。這裡直接在
    // 渲染後的 DOM 塞一顆繞過那道守衛的 <a>，單獨驗證 onClick 自己的
    // normalizeAllowedUrl 這一層——不是測 render.ts 不會產生它，是測「萬一真的混進來，
    // 這裡也接得住」
    const wrapper = mount(MarkdownView, { props: { source: EXTERNAL_LINK_SOURCE } })
    await waitForRender()

    const body = wrapper.get('.md-body').element
    const rogue = document.createElement('a')
    rogue.setAttribute('href', 'FTP://example.com')
    rogue.textContent = 'rogue'
    body.appendChild(rogue)

    await wrapper.get('a[href="FTP://example.com"]').trigger('click')

    expect(gateway.openUrl).not.toHaveBeenCalled()
  })

  it('相對路徑連結不可點，點擊不呼叫資料入口', async () => {
    const wrapper = mount(MarkdownView, { props: { source: RELATIVE_LINK_SOURCE } })
    await waitForRender()

    // render.ts 的入口守衛把它畫成 span，不是 a——這裡點的是那個 span
    expect(wrapper.find('a').exists()).toBe(false)
    await wrapper.find('.md-link-inert').trigger('click')

    expect(gateway.openUrl).not.toHaveBeenCalled()
  })

  it('允許範圍以外但通得過 markdown-it 內建黑名單的 scheme（tel:）一樣渲染為非互動樣式，點擊不呼叫資料入口', async () => {
    const wrapper = mount(MarkdownView, { props: { source: TEL_SCHEME_SOURCE } })
    await waitForRender()

    expect(wrapper.find('a').exists()).toBe(false)
    await wrapper.find('.md-link-inert').trigger('click')

    expect(gateway.openUrl).not.toHaveBeenCalled()
  })

  it.each([
    ['file:', FILE_SCHEME_SOURCE],
    ['javascript:', JS_SCHEME_SOURCE],
  ])('spec 點名的允許範圍以外 scheme（%s）不會渲染成可點連結，點擊不呼叫資料入口', async (_scheme, source) => {
    const wrapper = mount(MarkdownView, { props: { source } })
    await waitForRender()

    expect(wrapper.find('a').exists()).toBe(false)
    await wrapper.get('.md-body').trigger('click')

    expect(gateway.openUrl).not.toHaveBeenCalled()
  })

  it('點擊外部連結時攔下瀏覽器的預設導航（不是單純呼叫了 openUrl 而已）', async () => {
    const wrapper = mount(MarkdownView, { props: { source: EXTERNAL_LINK_SOURCE } })
    await waitForRender()

    const link = wrapper.get('a[href="https://example.com"]').element as HTMLAnchorElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    const notPrevented = link.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    // dispatchEvent 在 defaultPrevented 時回傳 false——雙重驗證同一件事的兩種讀法
    expect(notPrevented).toBe(false)
  })

  it('開啟失敗時跳出全 App 共用的非阻斷提示', async () => {
    gateway.openUrl.mockResolvedValue({ status: 'failed' })
    const wrapper = mount(MarkdownView, { props: { source: EXTERNAL_LINK_SOURCE } })
    await waitForRender()

    const notify = vi.spyOn(useChangesStore(), 'notify')
    await wrapper.find('a[href="https://example.com"]').trigger('click')
    await waitForRender()

    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('可勾選模式下 checkbox 仍可勾選——連結守衛收緊後未動到既有行為', async () => {
    const wrapper = mount(MarkdownView, {
      props: { source: '- [ ] task one', interactive: true },
    })
    await waitForRender()

    await wrapper.find('.task-list-item-checkbox').trigger('click')

    expect(wrapper.emitted('toggle')).toEqual([[0]])
    expect(gateway.openUrl).not.toHaveBeenCalled()
  })

  /**
   * `.md-ref` 是 render.ts 在 roadmap 選項對得到目標時才會產出的 `<button>`（design D4）。
   * 這裡比照上面「rogue」連結測試的手法：不依賴真的渲染出 `.md-ref`，直接在渲染後的 DOM
   * 補上一顆，單獨驗證 onClick 這段委派邏輯本身，與「`roadmap` prop 是否真的被轉傳給
   * `renderMarkdown`」（下面 `roadmap prop 轉傳` 這組測試）分開驗證，兩者互不取代。
   */
  it('點擊 .md-ref 時 emit ref 事件，帶 kind 與 target，不呼叫資料入口', async () => {
    const wrapper = mount(MarkdownView, { props: { source: 'plain text' } })
    await waitForRender()

    const body = wrapper.get('.md-body').element
    const button = document.createElement('button')
    button.setAttribute('type', 'button')
    button.className = 'md-ref'
    button.dataset.refKind = 'spec'
    button.dataset.refTarget = 'resilient-community-lifecycle'
    button.innerHTML = '<code>resilient-community-lifecycle</code>'
    body.appendChild(button)

    await wrapper.get('.md-ref').trigger('click')

    expect(wrapper.emitted('ref')).toEqual([[{ kind: 'spec', target: 'resilient-community-lifecycle' }]])
    expect(gateway.openUrl).not.toHaveBeenCalled()
  })

  it('唯讀模式（不帶 interactive）點擊 .md-ref 一樣 emit ref 事件——不受 interactive 限制', async () => {
    // 明確不傳 interactive：roadmap 面板本身是唯讀模式，引用連結仍要點得動（design D4）
    const wrapper = mount(MarkdownView, { props: { source: 'plain text' } })
    await waitForRender()

    const body = wrapper.get('.md-body').element
    const button = document.createElement('button')
    button.className = 'md-ref'
    button.dataset.refKind = 'roadmap'
    button.dataset.refTarget = '防災士名冊契約化.md'
    body.appendChild(button)

    await wrapper.get('.md-ref').trigger('click')

    expect(wrapper.emitted('ref')).toEqual([[{ kind: 'roadmap', target: '防災士名冊契約化.md' }]])
  })

  it('點擊 .md-ref 內部的子節點（實際渲染會把 <code> 包在 button 裡）一樣 emit ref——驗證委派走 closest 而非精準命中', async () => {
    const wrapper = mount(MarkdownView, { props: { source: 'plain text' } })
    await waitForRender()

    const body = wrapper.get('.md-body').element
    const button = document.createElement('button')
    button.className = 'md-ref'
    button.dataset.refKind = 'change'
    button.dataset.refTarget = 'add-roadmap-view'
    const code = document.createElement('code')
    code.textContent = 'add-roadmap-view'
    button.appendChild(code)
    body.appendChild(button)

    // 直接點內層 <code>，不是 button 本身——委派邏輯要靠 closest('.md-ref') 往上找到
    await wrapper.get('.md-ref code').trigger('click')

    expect(wrapper.emitted('ref')).toEqual([[{ kind: 'change', target: 'add-roadmap-view' }]])
  })

  it('點擊 .md-ref 不會同時觸發 toggle 或資料入口——三個分支互斥', async () => {
    const wrapper = mount(MarkdownView, { props: { source: 'plain text', interactive: true } })
    await waitForRender()

    const body = wrapper.get('.md-body').element
    const button = document.createElement('button')
    button.className = 'md-ref'
    button.dataset.refKind = 'spec'
    button.dataset.refTarget = 'no-restricted-imports'
    body.appendChild(button)

    await wrapper.get('.md-ref').trigger('click')

    expect(wrapper.emitted('ref')).toEqual([[{ kind: 'spec', target: 'no-restricted-imports' }]])
    expect(wrapper.emitted('toggle')).toBeUndefined()
    expect(gateway.openUrl).not.toHaveBeenCalled()
  })
})

/**
 * `roadmap` prop 本身是否真的被轉傳給 `renderMarkdown`（design D4、3.1／3.2 的邊界）。
 * 上面 `.md-ref` 那組測試全部手動在 DOM 補節點，繞過了真正的渲染管線，驗不到
 * `watch([source, interactive, roadmap], …)` 有沒有把 `props.roadmap` 交出去、
 * `resolveRef` 有沒有真的被呼叫——這裡用真實 mount＋真實 renderMarkdown 補上這段。
 */
describe('roadmap prop 轉傳給 renderMarkdown（design D4）', () => {
  it('不傳 roadmap 時，行內 code 維持一般 <code>，不呼叫任何解析函式', async () => {
    const wrapper = mount(MarkdownView, { props: { source: '`add-roadmap-view`' } })
    await waitForRender()

    expect(wrapper.find('.md-ref').exists()).toBe(false)
    expect(wrapper.get('code').text()).toBe('add-roadmap-view')
  })

  it('傳 roadmap 且 resolveRef 對得到目標時，真的渲染出 .md-ref，resolveRef 收到 code 原文', async () => {
    const resolveRef = vi.fn((code: string) =>
      code === 'add-roadmap-view' ? { kind: 'change' as const, target: 'add-roadmap-view' } : null)
    const wrapper = mount(MarkdownView, {
      props: { source: '`add-roadmap-view`', roadmap: { resolveRef } },
    })
    await waitForRender()

    expect(resolveRef).toHaveBeenCalledWith('add-roadmap-view')
    const ref = wrapper.get('.md-ref')
    expect(ref.attributes('data-ref-kind')).toBe('change')
    expect(ref.attributes('data-ref-target')).toBe('add-roadmap-view')

    await ref.trigger('click')
    expect(wrapper.emitted('ref')).toEqual([[{ kind: 'change', target: 'add-roadmap-view' }]])
  })

  it('唯讀模式（未傳 interactive）下，真的渲染出的 .md-ref 仍可點擊', async () => {
    const resolveRef = () => ({ kind: 'roadmap' as const, target: '防災士名冊契約化.md' })
    const wrapper = mount(MarkdownView, {
      props: { source: '`防災士名冊契約化.md`', roadmap: { resolveRef } },
    })
    await waitForRender()

    await wrapper.get('.md-ref').trigger('click')
    expect(wrapper.emitted('ref')).toEqual([[{ kind: 'roadmap', target: '防災士名冊契約化.md' }]])
  })

  it('roadmap prop 從無到有時會重新渲染，補上原本沒有的 .md-ref', async () => {
    const wrapper = mount(MarkdownView, { props: { source: '`add-roadmap-view`' } })
    await waitForRender()
    expect(wrapper.find('.md-ref').exists()).toBe(false)

    await wrapper.setProps({ roadmap: { resolveRef: () => ({ kind: 'change', target: 'add-roadmap-view' }) } })
    await waitForRender()

    expect(wrapper.find('.md-ref').exists()).toBe(true)
  })
})
