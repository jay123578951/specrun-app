<script setup lang="ts">
import { onUnmounted, ref } from 'vue'

/** 複製 change 名稱的圖示鈕：卡片標題旁與詳情面板右上共用 */

/** aria-label／title 的受詞；不傳沿用原文案，Roadmap 卡片與面板傳 'title' 換成「Copy title」 */
const props = withDefaults(defineProps<{ name: string, label?: string }>(), { label: 'change name' })

/** 成功回饋：icon 換 ✓ 後自動復原的停留時間（ui-interaction-states：不出 toast） */
const COPIED_MS = 2500

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.name)
  }
  catch {
    return // 剪貼簿被拒（權限／非安全來源）：不給成功回饋，寧可沒反應也不謊報
  }
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
  }, COPIED_MS)
}

onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <!-- .stop 與 park 鈕同理：在卡片上按這顆不能順便把詳情打開；面板端 stop 無副作用 -->
  <button
    type="button"
    class="icon-btn"
    :class="copied ? '!text-done' : ''"
    :aria-label="`Copy ${label}`"
    :title="copied ? 'Copied' : `Copy ${label}`"
    @click.stop="copy()"
  >
    <span
      class="h-4 w-4"
      :class="copied ? 'i-lucide-check' : 'i-lucide-copy'"
      aria-hidden="true"
    />
  </button>
</template>
