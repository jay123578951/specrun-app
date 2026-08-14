<script setup lang="ts">
import type { ProjectEntry } from '../api'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { gateway } from '../api'
import { useChangesStore } from '../stores/changes'
import { useProjectsStore } from '../stores/projects'

/**
 * 側欄的專案清單（design wireframe）：全展開直接點擊切換、hover ✕ 移除、
 * 底部「＋ Add project」。清單超過門檻才折疊，current 永遠可見。
 */

/** 超過這個數量才折疊；side bar 高度容得下的量，數字純憑手感（design 刻意留白） */
const COLLAPSE_THRESHOLD = 6

const projects = useProjectsStore()
const changes = useChangesStore()

const showAll = ref(false)
/** 正在確認移除的專案路徑；同時只會有一個 */
const confirming = ref<string | null>(null)
const draft = ref('')
const addError = ref('')
const pathInput = useTemplateRef<HTMLInputElement>('pathInput')

const visible = computed<ProjectEntry[]>(() => {
  const all = projects.projects
  if (showAll.value || all.length <= COLLAPSE_THRESHOLD)
    return all

  const head = all.slice(0, COLLAPSE_THRESHOLD)
  if (head.some(each => each.current))
    return head

  // current 被折在門檻外時擠掉最後一項——切換入口不能是「先展開才找得到」
  const current = all.find(each => each.current)
  return current ? [...head.slice(0, COLLAPSE_THRESHOLD - 1), current] : head
})

const collapsible = computed(() => projects.projects.length > COLLAPSE_THRESHOLD)

watch(() => projects.addFormOpen, async (open) => {
  if (!open) {
    draft.value = ''
    addError.value = ''
    return
  }
  await nextTick()
  pathInput.value?.focus()
})

/** 有原生選資料夾能力（Tauri）就直接開 dialog，沒有才展開貼路徑輸入列（design D5） */
async function startAdd(): Promise<void> {
  confirming.value = null
  if (!gateway.canPickFolder) {
    projects.addFormOpen = true
    return
  }

  const picked = await gateway.pickFolder()
  if (picked)
    await submitPath(picked)
}

async function submitAdd(): Promise<void> {
  await submitPath(draft.value)
}

async function submitPath(input: string): Promise<void> {
  addError.value = ''
  const result = await projects.add(input)
  if (!result.ok) {
    addError.value = result.message
    pathInput.value?.focus()
    return
  }

  if (result.alreadyExisted)
    changes.notify('That project is already in the list. Switched to it.')
  projects.addFormOpen = false
}

/** Esc／焦點離開就收起；已經打了字才留著，免得手滑點外面就白打一遍 */
function closeAdd(): void {
  projects.addFormOpen = false
}

function onFormFocusOut(event: FocusEvent): void {
  if (draft.value.trim() || addError.value)
    return
  const next = event.relatedTarget as Node | null
  if (!next || !(event.currentTarget as HTMLElement).contains(next))
    closeAdd()
}

async function confirmRemove(path: string): Promise<void> {
  confirming.value = null
  await projects.remove(path)
}
</script>

<template>
  <!-- 清單長到擠壓側欄其他段時自己捲，不把 Specs／Archive／Settings 推出畫面 -->
  <nav class="min-h-0 overflow-y-auto border-t border-line px-3 py-4" aria-label="Projects">
    <p class="px-2.5 text-ui-xs text-text-3 uppercase tracking-wider">
      Projects
    </p>

    <!-- 空清單：側欄只留一句與底下的 Add 入口，主區負責完整引導（spec 空清單引導） -->
    <p v-if="projects.loaded && !projects.projects.length" class="mt-2 px-2.5 text-ui-sm text-text-3">
      No projects yet.
    </p>

    <ul class="mt-2 space-y-0.5">
      <li v-for="project in visible" :key="project.path" class="group relative">
        <!-- 移除確認就地取代該列：側欄 224px 放不下對話框，而且確認的對象就在這一行 -->
        <div
          v-if="confirming === project.path"
          class="border border-line rounded bg-surface-hover px-2.5 py-2"
        >
          <p class="text-ui-sm text-text-2 text-pretty">
            Remove <span class="text-text font-mono">{{ project.name }}</span> from this list? Nothing on disk is deleted.
          </p>
          <div class="mt-2 flex gap-1.5">
            <button type="button" class="btn-danger flex-1" @click="confirmRemove(project.path)">
              Remove
            </button>
            <button type="button" class="btn-quiet-sm flex-1" @click="confirming = null">
              Cancel
            </button>
          </div>
        </div>

        <template v-else>
          <button
            type="button"
            class="project-item"
            :class="project.current
              ? 'bg-accent/15 text-accent-bright cursor-default hover:bg-accent/15'
              : 'text-text-2 hover:text-text'"
            :aria-current="project.current ? 'true' : undefined"
            :disabled="projects.busy && !project.current"
            :title="project.path"
            @click="projects.switchTo(project.path)"
          >
            <span
              class="h-1.5 w-1.5 shrink-0 rounded-full"
              :class="project.current ? 'bg-accent-bright' : 'bg-line'"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 truncate text-mono-base font-mono">{{ project.name }}</span>

            <!-- 暫時項（env／cwd 決定、未寫入設定）要看得出來，否則使用者會以為它已被記住 -->
            <span
              v-if="project.temporary"
              class="shrink-0 text-ui-xs text-text-3"
              title="Not saved to your project list"
            >temp</span>

            <span
              v-if="project.badge !== null"
              class="shrink-0 rounded-full px-1.5 text-mono-sm font-mono tabular-nums"
              :class="project.current ? 'bg-accent/25' : 'bg-line/60 text-text-3'"
            >{{ project.badge }}</span>
          </button>

          <!-- ✕ 疊在列上、不外擴點擊面積：外擴會從切換這個大目標身上偷走點擊 -->
          <button
            type="button"
            class="absolute top-1/2 h-5 w-5 flex items-center justify-center rounded text-text-3 opacity-0 transition-[opacity,color,background-color] duration-150 -translate-y-1/2 hover:bg-line/60 hover:text-text active:bg-line group-hover:opacity-100 disabled:cursor-not-allowed focus-visible:opacity-100 kbd-focus"
            :class="project.badge !== null || project.temporary ? 'right-9' : 'right-1.5'"
            :disabled="projects.busy"
            :aria-label="`Remove ${project.name} from the list`"
            :title="`Remove ${project.name} from the list`"
            @click="confirming = project.path"
          >
            <span class="i-lucide-x h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </template>
      </li>
    </ul>

    <button v-if="collapsible" type="button" class="side-action mt-0.5 text-ui-sm" @click="showAll = !showAll">
      <span
        class="i-lucide-chevron-down h-3.5 w-3.5 transition-transform duration-150"
        :class="showAll ? 'rotate-180' : ''"
        aria-hidden="true"
      />
      {{ showAll ? 'Show less' : `Show all (${projects.projects.length})` }}
    </button>

    <button type="button" class="side-action mt-0.5" :disabled="projects.busy" @click="startAdd()">
      <span class="i-lucide-plus h-4 w-4" aria-hidden="true" />
      Add project
    </button>

    <Transition
      enter-active-class="transition-[opacity,transform] duration-200 ease-[var(--sr-ease-out)] sr-motion"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition-opacity duration-150 ease-[var(--sr-ease-out)]"
      leave-to-class="opacity-0"
    >
      <form
        v-if="projects.addFormOpen"
        class="mt-1.5 px-1"
        @submit.prevent="submitAdd()"
        @focusout="onFormFocusOut"
        @keydown.esc="closeAdd()"
      >
        <div class="flex items-center gap-1.5">
          <label class="sr-only" for="project-path">Project folder path</label>
          <input
            id="project-path"
            ref="pathInput"
            v-model="draft"
            class="input-quiet"
            :class="addError ? 'border-error' : ''"
            type="text"
            placeholder="/path/to/repo"
            spellcheck="false"
            autocomplete="off"
            :aria-invalid="addError ? 'true' : undefined"
            aria-describedby="project-path-hint"
            :disabled="projects.busy"
            @input="addError = ''"
          >
          <button
            type="submit"
            class="btn-quiet-sm shrink-0"
            :disabled="!draft.trim() || projects.busy"
            :aria-busy="projects.busy"
          >
            <span
              v-if="projects.busy"
              class="i-lucide-loader-circle h-3.5 w-3.5 animate-spin"
              aria-hidden="true"
            />
            Add
          </button>
        </div>

        <!-- 提示與錯誤共用同一個槽、高度固定：錯誤冒出來不推動下方的 Specs／Archive -->
        <p
          id="project-path-hint"
          class="mt-1 min-h-4 px-0.5 text-ui-sm text-pretty"
          :class="addError ? 'text-error' : 'text-text-3'"
        >
          {{ addError || 'Paste a folder that contains openspec/.' }}
        </p>
      </form>
    </Transition>
  </nav>
</template>
