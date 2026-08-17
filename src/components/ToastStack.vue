<script setup lang="ts">
import { useChangesStore } from '../stores/changes'

const store = useChangesStore()
</script>

<template>
  <Teleport to="body">
    <div class="z-toast pointer-events-none fixed bottom-5 right-5 w-80 flex flex-col gap-2">
      <!-- 位移進場、淡出退場（退場較短）；reduced motion 由 .sr-motion 降成純淡入淡出 -->
      <TransitionGroup
        enter-active-class="transition-[opacity,transform] duration-200 ease-[var(--sr-ease-out)]"
        enter-from-class="opacity-0 translate-y-2"
        leave-active-class="transition-[opacity,transform] duration-150 ease-[var(--sr-ease-out)]"
        leave-to-class="opacity-0 translate-y-1"
        move-class="transition-transform duration-200 ease-[var(--sr-ease-out)]"
      >
        <div
          v-for="toast in store.toasts"
          :key="toast.id"
          class="sr-motion pointer-events-auto flex items-start gap-2.5 border border-line rounded bg-surface px-3.5 py-3 shadow-[var(--sr-shadow-overlay)]"
          role="status"
        >
          <!-- 告知型不掛警示圖示：驚嘆號用在沒出錯的事情上，久了整個 stack 都不再被當真 -->
          <span
            class="mt-0.5 h-4 w-4 shrink-0"
            :class="toast.tone === 'info'
              ? 'i-lucide-info text-accent-bright'
              : 'i-lucide-triangle-alert text-error'"
            aria-hidden="true"
          />
          <div class="min-w-0">
            <p class="text-ui-sm text-text">
              {{ toast.message }}
            </p>
            <p v-if="toast.detail" class="mt-0.5 truncate text-ui-sm text-text-3 font-mono" :title="toast.detail">
              {{ toast.detail }}
            </p>
          </div>
          <!-- 視覺刻意比 icon-btn 小一階且無邊框——浮層上的次要動作不該與面板工具列同份量；
               點擊面積則靠 ::before 補到 44px 與 icon-btn 同級。toast 卡片本體不可點，外擴不會偷走任何點擊。
               -2px 是光學補償：items-start 下 24.5px 的方框中心會落在 13px 標題行的中心下方 1.85px -->
          <button
            type="button"
            class="kbd-focus relative ml-auto mt-[-2px] h-7 w-7 flex shrink-0 items-center justify-center rounded text-text-3 transition-colors duration-150 before:absolute before:-inset-[10px] before:content-[''] hover:text-text"
            aria-label="Dismiss"
            @click="store.dismissToast(toast.id)"
          >
            <span class="i-lucide-x h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
