<script setup lang="ts">
import { ref, watch } from 'vue'

/**
 * slideover 三處（Artifact／Spec／Archived）共用的外殼（design D5：rule of three 到齊）。
 *
 * 這裡只放三頁都相同的骨架——定位／底色／左緣線、header 的收合鈕與動作槽、
 * 捲動容器與換內容時的捲動歸零；標題、tabs、內容各自從 slot 填。
 * 進出場動畫仍留在 App.vue 的 PANEL_MOTION（三頁共用同一組值）。
 */

const props = defineProps<{
  /** 收合鈕 aria-label 的主體（`spec`／`detail`／`archived change`） */
  collapseLabel: string
  /** 換內容的識別鍵：值一變就把捲動歸零（沿用上一份的位置只會讀到半途） */
  scrollKey: string
}>()

defineEmits<{ collapse: [] }>()

const scroller = ref<HTMLElement>()

watch(() => props.scrollKey, () => {
  if (scroller.value)
    scroller.value.scrollTop = 0
})
</script>

<template>
  <!-- 底色抬一階＋左緣一條線就是全部的層次：無陰影、無 backdrop，
       露出區的清單不變暗也不被攔截（spec artifact-view 無遮罩） -->
  <section class="min-w-0 flex flex-col overflow-hidden border-l border-line bg-surface">
    <header class="shrink-0 border-b border-line px-8 pt-4">
      <!-- 控制列自成一條：標題放大後與 24.5px 的 icon-btn 並排會比例打架，
           所以按鈕收在上方兩端，標題獨佔下一列 -->
      <div class="flex items-center">
        <!-- 收合不是關閉：面板是滑回右邊，圖示用箭頭而非 ✕ -->
        <button
          type="button"
          class="icon-btn"
          :aria-label="`Collapse ${collapseLabel} (Esc)`"
          title="Collapse (Esc)"
          @click="$emit('collapse')"
        >
          <span class="i-lucide-chevrons-right h-3.5 w-3.5" aria-hidden="true" />
        </button>

        <!-- ml-auto 之後是動作槽：refresh 等按鈕由各面板自己填 -->
        <div class="ml-auto flex shrink-0 items-center gap-2">
          <slot name="actions" />
        </div>
      </div>

      <slot name="header" />
    </header>

    <div ref="scroller" class="min-h-0 flex-1 overflow-y-auto px-8 py-7">
      <slot />
    </div>
  </section>
</template>
