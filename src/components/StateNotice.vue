<script setup lang="ts">
withDefaults(defineProps<{
  icon: string
  title: string
  body: string
  /** 目標專案路徑等技術細節，mono 顯示、完整值留在 title */
  detail?: string
  tone?: 'neutral' | 'error'
}>(), { tone: 'neutral' })
</script>

<template>
  <!-- 空狀態與區塊級錯誤共用：圖示＋一句原因＋一句怎麼辦，四種文案互不重複 -->
  <div
    class="border rounded-lg px-6 py-10 text-center"
    :class="tone === 'error' ? 'border-error/40 bg-error/5' : 'border-line bg-surface'"
  >
    <span
      class="mx-auto block h-6 w-6"
      :class="[icon, tone === 'error' ? 'text-error' : 'text-text-3']"
    />
    <p class="mt-3 text-ui-base text-text">
      {{ title }}
    </p>
    <p class="mx-auto mt-1 max-w-[52ch] text-ui-sm text-text-3 text-pretty">
      {{ body }}
    </p>
    <p v-if="detail" class="mx-auto mt-3 max-w-full truncate text-mono-sm text-text-3 font-mono" :title="detail">
      {{ detail }}
    </p>
    <div v-if="$slots.default" class="mt-5 flex justify-center">
      <slot />
    </div>
  </div>
</template>
