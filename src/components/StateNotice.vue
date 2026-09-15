<script setup lang="ts">
withDefaults(defineProps<{
  icon: string
  title: string
  body: string
  /** 目標專案路徑等技術細節，mono 顯示、完整值留在 title */
  detail?: string
  tone?: 'neutral' | 'error'
  /**
   * 空群組作為拖曳目的地：由自身的邊框與底色表達標示。
   * 呼叫端 MUST NOT 在外層另加 outline——這個區塊已經有一圈實線框，外加即成雙層框。
   */
  target?: boolean
}>(), { tone: 'neutral', target: false })
</script>

<template>
  <!-- 空狀態與區塊級錯誤共用：圖示＋一句原因＋一句怎麼辦，四種文案互不重複 -->
  <div
    class="border rounded-lg px-6 py-10 text-center transition-[background-color,border-color] duration-150 ease-[var(--sr-ease-out)]"
    :class="tone === 'error'
      ? 'border-error/40 bg-error/5'
      : (target ? 'border-line border-dashed bg-accent/6' : 'border-line bg-surface')"
  >
    <span
      class="mx-auto block h-6 w-6"
      :class="[icon, tone === 'error' ? 'text-error' : 'text-text-3']"
    />
    <p class="mt-3 text-ui-base text-text">
      {{ title }}
    </p>
    <!-- 成為落點時整塊提亮：只動文字階，不加第二種顏色 -->
    <p class="mx-auto mt-1 max-w-[52ch] text-ui-sm text-pretty" :class="target ? 'text-text-2' : 'text-text-3'">
      {{ body }}
    </p>
    <p v-if="detail" class="mx-auto mt-3 max-w-full truncate text-ui-sm text-text-3 font-mono" :title="detail">
      {{ detail }}
    </p>
    <div v-if="$slots.default" class="mt-5 flex justify-center">
      <slot />
    </div>
  </div>
</template>
