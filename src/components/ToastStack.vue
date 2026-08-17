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
          <button
            type="button"
            class="kbd-focus ml-auto shrink-0 rounded p-1 text-text-3 transition-colors duration-150 hover:text-text"
            aria-label="Dismiss"
            @click="store.dismissToast(toast.id)"
          >
            <span class="i-lucide-x h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
