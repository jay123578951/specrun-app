// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import CopyNameButton from './CopyNameButton.vue'

/**
 * `label` prop（本批新增）：aria-label／title 的受詞，預設 'change name' 維持原文案不變，
 * Roadmap 卡片與面板傳 'title'（Requirement 卡片的複製標題、詳情 header）。
 */

function stubClipboard(writeText: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
}

describe('copyNameButton', () => {
  it('不傳 label 時沿用原文案「Copy change name」（既有呼叫端行為不變）', () => {
    const wrapper = mount(CopyNameButton, { props: { name: 'add-roadmap-view' } })
    const button = wrapper.get('button')

    expect(button.attributes('aria-label')).toBe('Copy change name')
    expect(button.attributes('title')).toBe('Copy change name')
  })

  it('傳 label="title" 時文案換成「Copy title」（Roadmap 卡片／面板用法）', () => {
    const wrapper = mount(CopyNameButton, { props: { name: '培訓機構管理', label: 'title' } })
    const button = wrapper.get('button')

    expect(button.attributes('aria-label')).toBe('Copy title')
    expect(button.attributes('title')).toBe('Copy title')
  })

  it('點擊複製 name 的純文字內容到剪貼簿', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)
    const wrapper = mount(CopyNameButton, { props: { name: '色彩透明度寫法失效（/N）', label: 'title' } })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('色彩透明度寫法失效（/N）')
  })

  it('點擊事件不外傳：外層 click handler 收不到（卡片標題旁點複製不能順便打開詳情）', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)
    const onCardClick = vi.fn()
    const wrapper = mount({
      components: { CopyNameButton },
      template: '<div @click="onCardClick"><CopyNameButton name="x" @click="() => {}" /></div>',
      setup: () => ({ onCardClick }),
    })

    await wrapper.get('button').trigger('click')

    expect(onCardClick).not.toHaveBeenCalled()
  })

  it('複製成功後短暫呈現完成狀態，逾時後自動復原', async () => {
    vi.useFakeTimers()
    try {
      const writeText = vi.fn().mockResolvedValue(undefined)
      stubClipboard(writeText)
      const wrapper = mount(CopyNameButton, { props: { name: 'x' } })

      await wrapper.get('button').trigger('click')
      // clipboard.writeText 是微任務，假時鐘不影響 promise 排程，flushPromises 排空即可
      await flushPromises()

      expect(wrapper.get('button').attributes('title')).toBe('Copied')
      expect(wrapper.find('.i-lucide-check').exists()).toBe(true)

      vi.advanceTimersByTime(2500)
      await wrapper.vm.$nextTick()

      expect(wrapper.get('button').attributes('title')).toBe('Copy change name')
      expect(wrapper.find('.i-lucide-copy').exists()).toBe(true)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('剪貼簿寫入失敗時不呈現完成狀態，也不拋出例外', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    stubClipboard(writeText)
    const wrapper = mount(CopyNameButton, { props: { name: 'x' } })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalled()
    expect(wrapper.get('button').attributes('title')).toBe('Copy change name')
  })
})
