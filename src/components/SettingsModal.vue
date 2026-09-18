<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useSettingsStore } from '../stores/settings'

/**
 * App 的第一個 modal：內容為 1 組控制＋4 行唯讀，有硬上限、永不捲動，
 * 所以由內容決定尺寸而不是由容器決定。疊在任何頁之上、不進 App.vue 的面板槽——
 * 詳情開著也能疊上來，關掉就回到原狀。
 */

const settings = useSettingsStore()

/** 進出場的時值與曲線住在 interactions.css 的 .settings-*（後代選擇器與個別屬性 utility 組不出） */
const MODAL_MOTION = {
  'enter-active-class': 'settings-enter',
  'enter-from-class': 'settings-from opacity-0',
  'leave-active-class': 'settings-leave',
  'leave-to-class': 'settings-from opacity-0',
} as const

/** 內容決定寬度：最長的一行是 config.json 的絕對路徑 */
const PANEL_WIDTH = 620

const panel = ref<HTMLElement>()
/** 開啟它的那個元素；關閉後焦點歸還於此（側欄 Settings 項或 banner 的入口） */
let opener: HTMLElement | null = null

const isAuto = computed(() => settings.mode === 'auto')

/** 診斷區四行：值取不到就是佔位，不編一份看起來像真的假資料 */
const rows = computed(() => {
  const env = settings.diagnostics
  return [
    {
      key: 'config',
      label: 'Config file',
      value: env?.configPath ?? '—',
      mono: true,
      revealable: true,
      target: env?.configPath ?? null,
    },
    {
      key: 'project',
      label: 'Current project',
      // 無目標專案要明確說出來，不能留空白或顯示誤導的路徑
      value: env ? (env.projectPath ?? 'No project selected') : '—',
      mono: Boolean(env?.projectPath),
      revealable: true,
      target: env?.projectPath ?? null,
    },
    {
      key: 'watch',
      label: 'Live refresh',
      value: watchValue(env?.watching),
      mono: false,
      revealable: false,
      target: null,
    },
    {
      key: 'version',
      label: 'App version',
      value: env?.appVersion ?? '—',
      mono: true,
      revealable: false,
      target: null,
    },
  ]
})

/** 診斷尚未回來時（env 本身不存在）先佔位；watching 一旦有值就只剩已接上／未接上兩態 */
function watchValue(watching: boolean | undefined): string {
  if (watching === undefined)
    return '—'
  return watching ? 'Connected' : 'Not connected'
}

/**
 * 禁用的原因要三條路徑都讀得到：`title` 只給指標，`aria-describedby` 指向的
 * sr-only 說明給輔助技術，`aria-disabled` 讓按鈕仍可聚焦——原生 `disabled`
 * 的按鈕不進 tab 序列，鍵盤使用者連停都停不上去。
 */
function revealDisabled(target: string | null): boolean {
  return !settings.canReveal || !target
}

function onReveal(target: string | null): void {
  if (revealDisabled(target))
    return
  settings.reveal(target)
}

/** 禁用有三個成因，措辭要各自對得上——說明會被輔助技術當成「為什麼不能按」唸出來 */
function revealHint(target: string | null): string {
  // 診斷還沒回來時按鈕已經是禁用態，這一瞬給的理由得是「還在問」——診斷區的
  // 四行以「—」表達同一件事，不能在這裡改口說成「這個平台辦不到」
  if (!settings.diagnostics)
    return 'Checking whether this app can show a file in its folder.'
  // 每個執行形態都持有自己的開啟通道、答得出可不可用，禁用只剩這一種平台成因
  if (!settings.canReveal)
    return 'Showing a file in its folder is not available on this platform.'
  if (!target)
    return 'There is no path to show for this item yet.'
  return 'Show in Finder'
}

watch(() => settings.isOpen, async (open) => {
  if (open) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    window.addEventListener('keydown', onKeydown)
    await nextTick()
    // 初始焦點給盒子本身而不是關閉鈕——第一個 Tab 才落在真正的控制項上
    panel.value?.focus()
    return
  }

  window.removeEventListener('keydown', onKeydown)
  opener?.focus()
  opener = null
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))

/**
 * Esc 由 Settings 自己處理：全域 handler 在 modal 開啟時整個讓位，
 * 所以 Esc 絕不會穿透關掉背後的詳情面板。Tab 的環繞也在這裡——modal 開啟期間
 * 焦點不得離開盒子（ui-interaction-states 的 modal 規範）。
 */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    settings.close()
    return
  }
  if (event.key !== 'Tab')
    return

  const targets = focusable()
  if (!targets.length) {
    event.preventDefault()
    return
  }

  const first = targets[0]!
  const last = targets[targets.length - 1]!
  const active = document.activeElement

  // 焦點在盒子本身（tabindex -1）時交給瀏覽器：正向自然落在第一項，反向才要接手
  if (event.shiftKey && (active === first || active === panel.value)) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function focusable(): HTMLElement[] {
  const found = panel.value?.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
  )
  return [...found ?? []]
}
</script>

<template>
  <Teleport to="body">
    <Transition v-bind="MODAL_MOTION">
      <div v-if="settings.isOpen" class="z-modal fixed inset-0 flex items-center justify-center p-6">
        <!-- 極輕壓暗＋攔截點擊；點遮罩即關（驗證即套用，沒有未儲存狀態可弄丟） -->
        <div class="absolute inset-0 bg-overlay" @click="settings.close()" />

        <div
          ref="panel"
          class="settings-panel sr-motion relative max-h-full w-full flex flex-col overflow-hidden border border-line rounded-lg bg-surface shadow-[var(--sr-shadow-overlay)] outline-none"
          :style="{ maxWidth: `${PANEL_WIDTH}px` }"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
          tabindex="-1"
        >
          <header class="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
            <h2 id="settings-title" class="text-ui-lg text-text">
              Settings
            </h2>
            <button type="button" class="icon-btn" aria-label="Close settings" @click="settings.close()">
              <span class="i-lucide-x h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          <div class="overflow-y-auto px-6 py-5 space-y-6">
            <section>
              <h3 class="text-ui-xs text-text-3 uppercase tracking-wider">
                openspec CLI
              </h3>
              <p class="mt-1.5 text-ui-sm text-text-2 text-pretty">
                The engine behind every list and detail view. Auto-detect covers a normal install; set the
                path yourself when this app cannot see your shell's PATH.
              </p>

              <!-- 兩模式互斥：原生 radio 才拿得到方向鍵與群組語意，focus ring 走全站同一條規則 -->
              <div class="mt-3.5 flex flex-wrap items-center gap-x-6 gap-y-2">
                <label
                  class="flex items-center gap-2 text-ui-base text-text-2 transition-opacity duration-150 ease-[var(--sr-ease-out)] has-[:disabled]:opacity-55 has-[:enabled]:cursor-pointer has-[:enabled]:hover:text-text"
                >
                  <input
                    class="kbd-focus h-4 w-4 cursor-pointer accent-accent-bright disabled:cursor-not-allowed"
                    type="radio"
                    name="cli-mode"
                    :checked="isAuto"
                    :disabled="settings.busy"
                    @change="settings.useAuto()"
                  >
                  Auto-detect
                </label>
                <label
                  class="flex items-center gap-2 text-ui-base text-text-2 transition-opacity duration-150 ease-[var(--sr-ease-out)] has-[:disabled]:opacity-55 has-[:enabled]:cursor-pointer has-[:enabled]:hover:text-text"
                >
                  <input
                    class="kbd-focus h-4 w-4 cursor-pointer accent-accent-bright disabled:cursor-not-allowed"
                    type="radio"
                    name="cli-mode"
                    :checked="!isAuto"
                    :disabled="settings.busy"
                    @change="settings.useManual()"
                  >
                  Set path manually
                </label>
              </div>

              <div v-if="isAuto" class="mt-3 flex items-center gap-3">
                <p class="min-w-0 flex-1 truncate text-ui-sm text-text-2 font-mono" :title="settings.settings?.bin ?? ''">
                  {{ settings.settings?.bin ?? 'Nothing detected' }}
                </p>
                <button
                  type="button"
                  class="btn-sm shrink-0"
                  :disabled="settings.busy"
                  :aria-busy="settings.detecting"
                  @click="settings.useAuto()"
                >
                  <span
                    class="i-lucide-refresh-cw h-4 w-4"
                    :class="{ 'animate-spin': settings.detecting }"
                    aria-hidden="true"
                  />
                  Detect again
                </button>
              </div>

              <div v-else class="mt-3">
                <div class="flex items-center gap-3">
                  <input
                    class="input-quiet h-11 flex-1 text-ui-base"
                    type="text"
                    spellcheck="false"
                    autocomplete="off"
                    aria-label="Path to the openspec executable"
                    placeholder="/Users/you/Library/pnpm/openspec"
                    :disabled="settings.busy"
                    :value="settings.draft"
                    @input="settings.setDraft(($event.target as HTMLInputElement).value)"
                    @keydown.enter="settings.apply()"
                  >
                  <button
                    type="button"
                    class="btn shrink-0"
                    :disabled="settings.busy"
                    :aria-busy="settings.applying"
                    @click="settings.apply()"
                  >
                    <span
                      v-if="settings.applying"
                      class="i-lucide-loader-circle h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Verify &amp; apply
                  </button>
                </div>
                <!-- 不做檔案選擇對話框：openspec 幾乎都裝在隱藏目錄，
                     原生 dialog 預設看不到；路徑的來源本來就是終端機輸出 -->
                <p class="mt-2 text-ui-sm text-text-3 text-pretty">
                  Run <code class="text-text-2 font-mono">which openspec</code> in your terminal and paste the
                  path here. Verifying applies it right away — there is nothing else to save.
                </p>
              </div>

              <!-- 狀態列就地呈現，不走 toast：toast 會自動消失，而驗證結果要一直留著，
                   讓人核對版本或照著失敗訊息排錯。設定盒裡本來就有位置可貼——
                   有專屬位置就地貼、沒有位置才 toast -->
              <!-- 單行狀態（ok／unverified）真的上下置中；只有 failed 是兩行，才靠上對齊第一行 -->
              <div
                class="mt-3.5 flex gap-2.5 border border-line rounded bg-bg px-3 py-2.5"
                :class="settings.status.kind === 'failed' ? 'items-start' : 'items-center'"
              >
                <span
                  class="h-4 w-4 shrink-0"
                  :class="{
                    'mt-0.5': settings.status.kind === 'failed',
                    'i-lucide-circle-dashed text-text-3': settings.status.kind === 'unverified',
                    'i-lucide-circle-check text-done': settings.status.kind === 'ok',
                    'i-lucide-triangle-alert text-error': settings.status.kind === 'failed',
                  }"
                  aria-hidden="true"
                />
                <div class="min-w-0" role="status">
                  <!-- 成功態只講版本：路徑在上面那一區已經看得到（自動模式一行、手動模式在輸入欄裡），
                       在這裡再貼一次是同一個值佔兩個位置 -->
                  <p v-if="settings.status.kind === 'ok'" class="text-ui-sm text-text">
                    Working — openspec {{ settings.status.version }}
                  </p>
                  <template v-else-if="settings.status.kind === 'failed'">
                    <p class="text-ui-sm text-text">
                      Not working
                    </p>
                    <p class="mt-0.5 text-ui-sm text-text-3 font-mono text-pretty">
                      {{ settings.status.message }}
                    </p>
                  </template>
                  <p v-else class="text-ui-sm text-text-2">
                    Not verified yet.
                  </p>
                </div>
              </div>
            </section>

            <section class="border-t border-line pt-5">
              <h3 class="text-ui-xs text-text-3 uppercase tracking-wider">
                Environment
              </h3>
              <!-- 這一區不是設定，是「App 到底連到什麼」的答案：唯讀，沒有任何改值的操作 -->
              <dl class="mt-3 space-y-2">
                <div v-for="row in rows" :key="row.key" class="flex items-center gap-3">
                  <dt class="w-32 shrink-0 text-ui-sm text-text-3">
                    {{ row.label }}
                  </dt>
                  <!-- 值與按鈕同在 dd 內：dl 的內容只放得下 dt／dd，按鈕與說明是這一項的一部分 -->
                  <dd class="min-w-0 flex flex-1 items-center gap-3">
                    <span
                      class="min-w-0 flex-1 truncate text-ui-sm"
                      :class="row.mono ? 'text-text-2 font-mono' : 'text-text-2'"
                      :title="row.value"
                    >
                      {{ row.value }}
                    </span>
                    <!-- 不支援的平台顯示為禁用＋說明原因，不隱藏：隱藏會讓使用者
                         既不知道有這個能力、也不知道為何沒有。原因不另闢一行，
                         它只屬於這兩顆按鈕 -->
                    <template v-if="row.revealable">
                      <button
                        type="button"
                        class="btn-inline shrink-0 aria-disabled:cursor-not-allowed aria-disabled:opacity-55 aria-disabled:active:bg-transparent aria-disabled:hover:bg-transparent aria-disabled:hover:text-text-2"
                        :aria-disabled="revealDisabled(row.target)"
                        :aria-describedby="revealDisabled(row.target) ? `${row.key}-reveal-hint` : undefined"
                        :title="revealHint(row.target)"
                        :aria-label="`Show ${row.label.toLowerCase()} in its folder`"
                        @click="onReveal(row.target)"
                      >
                        <span class="i-lucide-folder-open h-4 w-4" aria-hidden="true" />
                      </button>
                      <span v-if="revealDisabled(row.target)" :id="`${row.key}-reveal-hint`" class="sr-only">
                        {{ revealHint(row.target) }}
                      </span>
                    </template>
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
