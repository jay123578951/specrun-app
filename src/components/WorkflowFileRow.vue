<script setup lang="ts">
import type { WorkflowFilesEntry } from '../api'
import { useSettingsStore } from '../stores/settings'

defineProps<{ entry: WorkflowFilesEntry }>()

const settings = useSettingsStore()

const WORKFLOW_STATUS = {
  behind: { label: 'Behind CLI', icon: 'i-lucide-circle-arrow-up text-accent-bright' },
  current: { label: 'Up to date', icon: 'i-lucide-circle-check text-done' },
  ahead: { label: 'Newer than CLI', icon: 'i-lucide-circle-arrow-down text-text-3' },
  unset: { label: 'Not set up', icon: 'i-lucide-circle-dashed text-text-3' },
  missing: { label: 'Folder not found', icon: 'i-lucide-triangle-alert text-error' },
} as const

function projectName(entry: WorkflowFilesEntry): string {
  return entry.path.split(/[\\/]/).filter(Boolean).pop() ?? entry.path
}

function rowNote(path: string): { failed: boolean, text: string } | null {
  const op = settings.workflowOps[path]
  if (op?.kind === 'failed')
    return { failed: true, text: `Update failed: ${op.message}` }
  if (op?.kind === 'done' && op.warning)
    return { failed: false, text: op.warning }
  return null
}
</script>

<template>
  <li class="min-h-9 py-1" data-testid="workflow-row">
    <div class="flex items-center gap-3">
      <span class="min-w-0 flex-1 truncate text-ui-sm text-text" :title="entry.path">
        {{ projectName(entry) }}
      </span>
      <span class="w-16 shrink-0 text-right text-ui-sm text-text-2 font-mono tabular-nums">
        {{ entry.version ?? '-' }}
      </span>
      <span class="w-36 flex shrink-0 items-center gap-1.5 text-ui-sm text-text-2">
        <template v-if="entry.status">
          <span class="h-4 w-4 shrink-0" :class="WORKFLOW_STATUS[entry.status].icon" aria-hidden="true" />
          {{ WORKFLOW_STATUS[entry.status].label }}
        </template>
      </span>
      <span class="w-20 flex shrink-0 justify-end">
        <button
          v-if="entry.status === 'behind'"
          type="button"
          class="btn-sm"
          :aria-label="`Update ${projectName(entry)}`"
          :disabled="settings.workflowOps[entry.path]?.kind === 'updating'"
          :aria-busy="settings.workflowOps[entry.path]?.kind === 'updating'"
          @click="settings.updateWorkflowFile(entry.path)"
        >
          <span
            v-if="settings.workflowOps[entry.path]?.kind === 'updating'"
            class="i-lucide-loader-circle h-4 w-4 animate-spin"
            aria-hidden="true"
          />
          {{ settings.workflowOps[entry.path]?.kind === 'updating' ? 'Updating' : 'Update' }}
        </button>
      </span>
    </div>
    <p
      v-if="rowNote(entry.path)"
      class="mt-1 flex items-start gap-2 text-ui-sm text-text-3"
      role="status"
    >
      <span
        class="mt-0.5 h-4 w-4 shrink-0"
        :class="rowNote(entry.path)!.failed ? 'i-lucide-triangle-alert text-error' : 'i-lucide-info'"
        aria-hidden="true"
      />
      <span class="min-w-0 font-mono text-pretty">{{ rowNote(entry.path)!.text }}</span>
    </p>
  </li>
</template>
