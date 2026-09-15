<script setup lang="ts">
import { shallowRef, useTemplateRef, watch } from 'vue'
import { renderMarkdown } from '../markdown/render'

const props = defineProps<{
  source: string
  /** tasks 單檔時開啟：checkbox 可點 */
  interactive?: boolean
  /** 寫入進行中的來源行號；這些 checkbox 呈現 pending 且不再接受點擊 */
  pendingLines?: number[]
}>()

const emit = defineEmits<{ toggle: [line: number] }>()

const html = shallowRef('')
// 渲染是 async（highlighter 首次要載語言），快速切 tab 會有多個 render 在飛：
// 只認最後一次發出的，避免舊內容後到覆蓋新的
let seq = 0

watch([() => props.source, () => props.interactive], async ([source, interactive]) => {
  const mine = ++seq
  const rendered = await renderMarkdown(source, { interactive })
  if (mine === seq)
    html.value = rendered
}, { immediate: true })

const root = useTemplateRef<HTMLElement>('root')

/**
 * pending 是短暫的 in-flight 記號，走 DOM 屬性而非重渲染——
 * 為了一個狀態把整片 Markdown 重跑一次高亮並不划算。
 */
watch([html, () => props.pendingLines], () => {
  const el = root.value
  if (!el)
    return
  const pending = props.pendingLines ?? []
  for (const box of el.querySelectorAll<HTMLInputElement>('.task-list-item-checkbox[data-line]'))
    box.toggleAttribute('data-pending', pending.includes(Number(box.dataset.line)))
}, { flush: 'post' })

/** 整片 md-body 一個委派接住點擊，不逐顆 checkbox 綁 listener——每次重渲染整片都被換掉 */
function onClick(event: MouseEvent): void {
  if (!props.interactive)
    return

  const box = (event.target as Element | null)
    ?.closest<HTMLInputElement>('.task-list-item-checkbox[data-line]')
  if (!box)
    return

  // DOM 不是狀態源：翻轉一律由 store 對來源字串處理後重渲染，
  // 這裡擋掉瀏覽器自己的勾選，免得被忽略的點擊（pending 中）在畫面上留下假狀態
  event.preventDefault()
  if (box.hasAttribute('data-pending'))
    return

  const line = Number(box.dataset.line)
  if (Number.isInteger(line))
    emit('toggle', line)
}
</script>

<template>
  <!-- 渲染來源是本機 artifact，且管線維持 markdown-it 的 html: false -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div ref="root" class="md-body" @click="onClick" v-html="html" />
</template>
