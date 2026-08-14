<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { renderMarkdown } from '../markdown/render'

const props = defineProps<{ source: string }>()

const html = shallowRef('')
// 渲染是 async（highlighter 首次要載語言），快速切 tab 會有多個 render 在飛：
// 只認最後一次發出的，避免舊內容後到覆蓋新的
let seq = 0

watch(() => props.source, async (source) => {
  const mine = ++seq
  const rendered = await renderMarkdown(source)
  if (mine === seq)
    html.value = rendered
}, { immediate: true })
</script>

<template>
  <!-- 渲染來源是本機 artifact，且管線維持 markdown-it 的 html: false（design D5） -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="md-body" v-html="html" />
</template>
