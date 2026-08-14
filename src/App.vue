<script setup lang="ts">
import type { HealthResponse } from './api/types'
import { computed, onMounted, shallowRef } from 'vue'
import { getHealth } from './api'

// 取樣頁：驗證 token 管線通、值正確。非正式 UI，C1 會整頁換掉。
const swatches = [
  { name: 'bg', hex: '#11151A', class: 'bg-bg' },
  { name: 'surface', hex: '#1A1F27', class: 'bg-surface' },
  { name: 'surface-hover', hex: '#222834', class: 'bg-surface-hover' },
  { name: 'line', hex: '#323B48', class: 'bg-line' },
  { name: 'text', hex: '#DFE5ED', class: 'bg-text' },
  { name: 'text-2', hex: '#A7B0BD', class: 'bg-text-2' },
  { name: 'text-3', hex: '#6C7583', class: 'bg-text-3' },
  { name: 'accent', hex: '#3A7791', class: 'bg-accent' },
  { name: 'accent-bright', hex: '#82B4C9', class: 'bg-accent-bright' },
  { name: 'parked', hex: '#C4956B', class: 'bg-parked' },
  { name: 'done', hex: '#6BAFA3', class: 'bg-done' },
  { name: 'error', hex: '#C07886', class: 'bg-error' },
]

const scale = [
  { token: 'ui-base', class: 'text-ui-base font-ui', sample: 'Active changes in this project' },
  { token: 'ui-sm', class: 'text-ui-sm font-ui', sample: 'proposal · design · tasks' },
  { token: 'ui-xs', class: 'text-ui-xs font-ui uppercase tracking-wider', sample: 'Parked' },
  { token: 'mono-base', class: 'text-mono-base font-mono', sample: 'add-design-foundation' },
  { token: 'mono-sm', class: 'text-mono-sm font-mono', sample: '3/7' },
  { token: 'read-base', class: 'text-read-base font-tc', sample: '規格驅動的開發流程' },
  { token: 'read-h1', class: 'text-read-h1 font-ui', sample: 'Document title' },
  { token: 'read-h2', class: 'text-read-h2 font-ui font-600', sample: 'Section heading' },
  { token: 'read-h3', class: 'text-read-h3 font-ui font-600', sample: 'Sub heading' },
  { token: 'read-code', class: 'text-read-code font-mono', sample: 'openspec status --json' },
]

const icons = [
  'i-lucide-pause',
  'i-lucide-play',
  'i-lucide-copy',
  'i-lucide-trash-2',
  'i-lucide-settings',
  'i-lucide-external-link',
  'i-lucide-check',
]

const health = shallowRef<HealthResponse | null>(null)
const error = shallowRef<string | null>(null)

const healthLabel = computed(() => {
  if (!health.value)
    return null
  return `${health.value.status} · ${new Date(health.value.timestamp).toLocaleString()}`
})

onMounted(async () => {
  try {
    health.value = await getHealth()
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})
</script>

<template>
  <main class="mx-auto max-w-4xl px-8 py-12 space-y-12">
    <header class="flex items-baseline gap-3">
      <span class="text-read-h1 text-text font-serif font-600">specrun</span>
      <span class="text-ui-sm text-text-3 font-ui">design tokens</span>
    </header>

    <section class="space-y-4">
      <h2 class="text-ui-xs text-text-3 font-ui uppercase tracking-wider">
        Palette
      </h2>
      <ul class="grid grid-cols-4 gap-4">
        <li v-for="s in swatches" :key="s.name">
          <div class="h-12 border border-line rounded" :class="s.class" />
          <p class="mt-2 text-ui-sm text-text-2 font-ui">
            {{ s.name }}
          </p>
          <p class="text-mono-sm text-text-3 font-mono">
            {{ s.hex }}
          </p>
        </li>
      </ul>
    </section>

    <section class="space-y-4">
      <h2 class="text-ui-xs text-text-3 font-ui uppercase tracking-wider">
        Typefaces
      </h2>
      <div class="border border-line rounded-lg bg-surface p-6 space-y-5">
        <p class="text-ui-base text-text font-ui">
          Manrope 400 500 600 700 — UI text, buttons, sidebar items
        </p>
        <p class="text-mono-base text-text font-mono">
          IBM Plex Mono 400 500 — add-park-mechanism, ~/dev/specrun-app
        </p>
        <p class="text-read-base text-text font-tc max-w-[68ch]">
          IBM Plex Sans TC 400 500 600 這段繁體中文用來驗證分片字體：瀏覽器只會下載這幾個字所在的 unicode-range 片段，
          而不是整套字型。規格驅動的開發流程裡，變更提案、設計文件與任務清單都以 Markdown 呈現，閱讀區行高一．八五、欄寬六十八字元。
        </p>
        <p class="text-read-h1 text-text font-serif font-600">
          Lora — specrun wordmark
        </p>
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="text-ui-xs text-text-3 font-ui uppercase tracking-wider">
        Type scale
      </h2>
      <ul class="space-y-3">
        <li v-for="step in scale" :key="step.token" class="flex items-baseline gap-4">
          <span class="w-24 shrink-0 text-mono-sm text-text-3 font-mono">{{ step.token }}</span>
          <span class="text-text" :class="step.class">{{ step.sample }}</span>
        </li>
      </ul>
    </section>

    <section class="space-y-4">
      <h2 class="text-ui-xs text-text-3 font-ui uppercase tracking-wider">
        Icons
      </h2>
      <div class="flex items-center gap-5 text-text-2">
        <span v-for="icon in icons" :key="icon" class="h-5 w-5" :class="icon" />
      </div>
    </section>

    <footer class="border-t border-line pt-6 text-ui-sm font-ui">
      <p v-if="error" class="text-error">
        API error: {{ error }}
      </p>
      <p v-else-if="healthLabel" class="text-text-2">
        health: <span class="text-done">{{ healthLabel }}</span>
      </p>
      <p v-else class="text-text-3">
        loading…
      </p>
    </footer>
  </main>
</template>
