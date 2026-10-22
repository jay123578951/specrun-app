// @vitest-environment jsdom
import type { ProjectEntry } from '../api'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useProjectsStore } from '../stores/projects'
import ProjectSwitcher from './ProjectSwitcher.vue'

enableAutoUnmount(afterEach)

function entry(name: string, extra: Partial<ProjectEntry> = {}): ProjectEntry {
  return { path: `/p/${name}`, name, current: name === 'A', badge: null, ...extra } as ProjectEntry
}

function setup(entries: ProjectEntry[]) {
  setActivePinia(createPinia())
  const store = useProjectsStore()
  store.projects = entries
  store.loaded = true
  const reorder = vi.spyOn(store, 'reorder').mockResolvedValue()
  const switchTo = vi.spyOn(store, 'switchTo').mockResolvedValue()
  const wrapper = mount(ProjectSwitcher, { attachTo: document.body })
  return { store, reorder, switchTo, wrapper }
}

const paths = (...names: string[]) => names.map(each => `/p/${each}`)

function key(wrapper: ReturnType<typeof setup>['wrapper'], name: string, k: string) {
  return wrapper.get(`button[data-project-path="/p/${name}"]`).trigger('keydown', { key: k, altKey: true })
}

describe('projectSwitcher 鍵盤排序', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('alt+↓ 把專案往下移一格，focus 留在同一個專案', async () => {
    const { reorder, wrapper } = setup([entry('A'), entry('B'), entry('C')])
    wrapper.get<HTMLElement>('button[data-project-path="/p/A"]').element.focus()
    await key(wrapper, 'A', 'ArrowDown')
    expect(reorder).toHaveBeenCalledWith(paths('B', 'A', 'C'))
    await nextTick()
    expect((document.activeElement as HTMLElement).dataset.projectPath).toBe('/p/A')
  })

  it('頂端按 alt+↑ 不呼叫', async () => {
    const { reorder, wrapper } = setup([entry('A'), entry('B')])
    await key(wrapper, 'A', 'ArrowUp')
    expect(reorder).not.toHaveBeenCalled()
  })

  it('暫時項下方的第一個專案按 alt+↑ 不呼叫；暫時項本身不能移', async () => {
    const { reorder, wrapper } = setup([entry('T', { temporary: true }), entry('A'), entry('B')])
    await key(wrapper, 'A', 'ArrowUp')
    await key(wrapper, 'T', 'ArrowDown')
    expect(reorder).not.toHaveBeenCalled()
    await key(wrapper, 'A', 'ArrowDown')
    expect(reorder).toHaveBeenCalledWith(paths('B', 'A'))
  })

  it('busy 時不呼叫', async () => {
    const { store, reorder, wrapper } = setup([entry('A'), entry('B')])
    store.busy = true
    await key(wrapper, 'A', 'ArrowDown')
    expect(reorder).not.toHaveBeenCalled()
  })

  it('清單收合時不呼叫，展開後可以', async () => {
    const names = Array.from({ length: 13 }, (_, i) => String.fromCharCode(65 + i))
    const { reorder, wrapper } = setup(names.map(each => entry(each)))
    await key(wrapper, 'A', 'ArrowDown')
    expect(reorder).not.toHaveBeenCalled()
    await wrapper.findAll('button').find(each => each.text().startsWith('Show'))!.trigger('click')
    await key(wrapper, 'A', 'ArrowDown')
    expect(reorder).toHaveBeenCalledTimes(1)
  })

  it('alt+↑ 把中間的專案往上移一格；底端按 alt+↓ 不呼叫', async () => {
    const { reorder, wrapper } = setup([entry('A'), entry('B'), entry('C')])
    await key(wrapper, 'B', 'ArrowUp')
    expect(reorder).toHaveBeenCalledWith(paths('B', 'A', 'C'))
    reorder.mockClear()
    await key(wrapper, 'C', 'ArrowDown')
    expect(reorder).not.toHaveBeenCalled()
  })

  it('沒按 alt 的方向鍵不排序', async () => {
    const { reorder, wrapper } = setup([entry('A'), entry('B')])
    await wrapper.get('button[data-project-path="/p/A"]').trigger('keydown', { key: 'ArrowDown' })
    expect(reorder).not.toHaveBeenCalled()
  })

  it('可排序的專案提示文字有按鍵說明，暫時項沒有', () => {
    const { wrapper } = setup([entry('T', { temporary: true }), entry('A')])
    expect(wrapper.get('button[data-project-path="/p/A"]').attributes('title')).toContain('Alt+↑ / Alt+↓')
    expect(wrapper.get('button[data-project-path="/p/T"]').attributes('title')).not.toContain('Alt')
  })
})

describe('projectSwitcher 滑鼠拖曳', () => {
  /** jsdom 沒有版面；每列高 30、間距 4，從 y=0 往下排 */
  function layout(wrapper: ReturnType<typeof setup>['wrapper']) {
    wrapper.findAll('li').forEach((li, index) => {
      li.element.getBoundingClientRect = () => ({ top: index * 34, height: 30, bottom: index * 34 + 30 }) as DOMRect
      li.element.setPointerCapture = vi.fn()
      li.element.releasePointerCapture = vi.fn()
    })
  }

  /** jsdom 沒有 PointerEvent：用 MouseEvent 補上 pointerId */
  function fire(el: Element, type: string, y: number) {
    const event = new MouseEvent(type, { bubbles: true, clientY: y })
    Object.defineProperty(event, 'pointerId', { value: 1 })
    el.dispatchEvent(event)
    return nextTick()
  }

  function pointer(li: { element: Element }, type: string, y: number) {
    return fire(li.element, type, y)
  }

  it('移動不到 5px 放開是點擊，會切換專案', async () => {
    const { reorder, switchTo, wrapper } = setup([entry('A'), entry('B')])
    layout(wrapper)
    const li = wrapper.findAll('li')[1]
    await pointer(li, 'pointerdown', 50)
    await pointer(li, 'pointermove', 53)
    await pointer(li, 'pointerup', 53)
    await li.get('button').trigger('click')
    expect(reorder).not.toHaveBeenCalled()
    expect(switchTo).toHaveBeenCalledWith('/p/B')
  })

  it('拖過門檻放開後 reorder 收到新順序，click 被吞掉不切換', async () => {
    const { reorder, switchTo, wrapper } = setup([entry('A'), entry('B'), entry('C')])
    layout(wrapper)
    const li = wrapper.findAll('li')[2]
    await pointer(li, 'pointerdown', 80)
    await pointer(li, 'pointermove', 5)
    expect(wrapper.find('[data-remove]').exists()).toBe(false)
    await pointer(li, 'pointerup', 5)
    await li.get('button').trigger('click')
    expect(reorder).toHaveBeenCalledWith(paths('C', 'A', 'B'))
    expect(switchTo).not.toHaveBeenCalled()
  })

  it('按在 ✕ 上拖動不起拖', async () => {
    const { reorder, wrapper } = setup([entry('A'), entry('B')])
    layout(wrapper)
    const li = wrapper.findAll('li')[1]
    await fire(li.get('[data-remove]').element, 'pointerdown', 50)
    await pointer(li, 'pointermove', 0)
    await pointer(li, 'pointerup', 0)
    expect(reorder).not.toHaveBeenCalled()
  })

  it('pointercancel 後不呼叫 reorder，✕ 回來', async () => {
    const { reorder, wrapper } = setup([entry('A'), entry('B')])
    layout(wrapper)
    const li = wrapper.findAll('li')[1]
    await pointer(li, 'pointerdown', 50)
    await pointer(li, 'pointermove', 0)
    await pointer(li, 'pointercancel', 0)
    expect(reorder).not.toHaveBeenCalled()
    expect(wrapper.find('[data-remove]').exists()).toBe(true)
  })

  it('其他列讓位：被拖到最上面時，上方的列往下位移一列', async () => {
    const { wrapper } = setup([entry('A'), entry('B')])
    layout(wrapper)
    const lis = wrapper.findAll('li')
    await pointer(lis[1], 'pointerdown', 50)
    await pointer(lis[1], 'pointermove', 0)
    expect(lis[0].attributes('style')).toContain('translateY(34px)')
    expect(lis[1].attributes('style')).toContain('translateY(-34px)')
  })

  it('四個專案把 A 拖到中間：越過 B 的中線但沒越過 C 的，落在第二格', async () => {
    const { reorder, wrapper } = setup([entry('A'), entry('B'), entry('C'), entry('D')])
    layout(wrapper)
    const lis = wrapper.findAll('li')
    await pointer(lis[0], 'pointerdown', 10)
    await pointer(lis[0], 'pointermove', 50)
    await pointer(lis[0], 'pointerup', 50)
    expect(reorder).toHaveBeenCalledWith(paths('B', 'A', 'C', 'D'))
  })

  it('往下拖到最底，且不會超出清單範圍', async () => {
    const { reorder, wrapper } = setup([entry('A'), entry('B'), entry('C')])
    layout(wrapper)
    const lis = wrapper.findAll('li')
    await pointer(lis[0], 'pointerdown', 10)
    await pointer(lis[0], 'pointermove', 500)
    expect(lis[0].attributes('style')).toContain('translateY(68px)')
    await pointer(lis[0], 'pointerup', 500)
    expect(reorder).toHaveBeenCalledWith(paths('B', 'C', 'A'))
  })

  it('拖過門檻但沒越過鄰居中線，順序沒變就不呼叫，click 仍被吞掉', async () => {
    const { reorder, switchTo, wrapper } = setup([entry('A'), entry('B')])
    layout(wrapper)
    const li = wrapper.findAll('li')[1]
    await pointer(li, 'pointerdown', 50)
    await pointer(li, 'pointermove', 40)
    await pointer(li, 'pointerup', 40)
    await li.get('button').trigger('click')
    expect(reorder).not.toHaveBeenCalled()
    expect(switchTo).not.toHaveBeenCalled()
  })

  it('拖曳結束後樣式清掉，下一次點擊正常切換', async () => {
    const { switchTo, wrapper } = setup([entry('A'), entry('B'), entry('C')])
    layout(wrapper)
    const lis = wrapper.findAll('li')
    await pointer(lis[2], 'pointerdown', 80)
    await pointer(lis[2], 'pointermove', 5)
    await pointer(lis[2], 'pointerup', 5)
    expect(lis.every(each => each.attributes('style') === undefined)).toBe(true)
    await pointer(lis[1], 'pointerdown', 40)
    await pointer(lis[1], 'pointerup', 40)
    await lis[1].get('button').trigger('click')
    expect(switchTo).toHaveBeenCalledWith('/p/B')
  })

  it('暫時項不能被拖；往上拖其他專案最多停在暫時項正下方', async () => {
    const { reorder, wrapper } = setup([entry('T', { temporary: true }), entry('A'), entry('B')])
    layout(wrapper)
    const lis = wrapper.findAll('li')
    await pointer(lis[0], 'pointerdown', 10)
    await pointer(lis[0], 'pointermove', 100)
    await pointer(lis[0], 'pointerup', 100)
    expect(reorder).not.toHaveBeenCalled()

    await pointer(lis[2], 'pointerdown', 80)
    await pointer(lis[2], 'pointermove', -200)
    expect(lis[2].attributes('style')).toContain('translateY(-34px)')
    await pointer(lis[2], 'pointerup', -200)
    expect(reorder).toHaveBeenCalledWith(paths('B', 'A'))
  })

  it('收合時不能拖，放開照常切換', async () => {
    const names = Array.from({ length: 13 }, (_, i) => String.fromCharCode(65 + i))
    const { reorder, switchTo, wrapper } = setup(names.map(each => entry(each)))
    layout(wrapper)
    const li = wrapper.findAll('li')[2]
    await pointer(li, 'pointerdown', 80)
    await pointer(li, 'pointermove', 0)
    await pointer(li, 'pointerup', 0)
    await li.get('button').trigger('click')
    expect(reorder).not.toHaveBeenCalled()
    expect(switchTo).toHaveBeenCalledWith('/p/C')
  })

  it('按住 B 往下拖，越過門檻時指標已在 C 上，被搬的仍是 B', async () => {
    const { reorder, wrapper } = setup([entry('A'), entry('B'), entry('C')])
    layout(wrapper)
    const lis = wrapper.findAll('li')
    await pointer(lis[1], 'pointerdown', 50)
    await pointer(lis[2], 'pointermove', 90)
    await pointer(lis[2], 'pointerup', 90)
    expect(reorder).toHaveBeenCalledWith(paths('A', 'C', 'B'))
    expect(lis[1].element.setPointerCapture).toHaveBeenCalled()
    expect(lis[2].element.setPointerCapture).not.toHaveBeenCalled()
  })

  /** Pointer Events 的 pointerleave 不冒泡，只發在清單本身 */
  function leaveList(wrapper: ReturnType<typeof setup>['wrapper']) {
    wrapper.get('ul').element.dispatchEvent(new MouseEvent('pointerleave', { bubbles: false }))
    return nextTick()
  }

  it('門檻內滑出清單後，沒按鍵移回清單不會進入拖曳', async () => {
    const { reorder, wrapper } = setup([entry('A'), entry('B'), entry('C')])
    layout(wrapper)
    const lis = wrapper.findAll('li')
    await pointer(lis[0], 'pointerdown', 10)
    await leaveList(wrapper)
    await pointer(lis[0], 'pointermove', 80)
    expect(wrapper.find('[data-remove]').exists()).toBe(true)
    expect(lis[0].attributes('style')).toBeUndefined()
    await pointer(lis[0], 'pointerup', 80)
    expect(reorder).not.toHaveBeenCalled()
  })

  it('門檻內在列與列的空隙放開，之後移動不會進入拖曳', async () => {
    const { reorder, wrapper } = setup([entry('A'), entry('B'), entry('C')])
    layout(wrapper)
    const lis = wrapper.findAll('li')
    await pointer(lis[0], 'pointerdown', 10)
    await fire(wrapper.get('ul').element, 'pointerup', 32)
    await pointer(lis[0], 'pointermove', 80)
    expect(wrapper.find('[data-remove]').exists()).toBe(true)
    expect(lis[0].attributes('style')).toBeUndefined()
    await pointer(lis[0], 'pointerup', 80)
    expect(reorder).not.toHaveBeenCalled()
  })

  it('拖曳開始後指標滑出清單不中斷，放開照樣排序', async () => {
    const { reorder, wrapper } = setup([entry('A'), entry('B')])
    layout(wrapper)
    const lis = wrapper.findAll('li')
    await pointer(lis[1], 'pointerdown', 50)
    await pointer(lis[1], 'pointermove', 0)
    await leaveList(wrapper)
    expect(lis[1].attributes('style')).toContain('translateY(-34px)')
    await pointer(lis[1], 'pointerup', 0)
    expect(reorder).toHaveBeenCalledWith(paths('B', 'A'))
  })

  it('busy 時不能拖', async () => {
    const { store, reorder, wrapper } = setup([entry('A'), entry('B')])
    store.busy = true
    layout(wrapper)
    const li = wrapper.findAll('li')[1]
    await pointer(li, 'pointerdown', 50)
    await pointer(li, 'pointermove', 0)
    await pointer(li, 'pointerup', 0)
    expect(reorder).not.toHaveBeenCalled()
  })
})
