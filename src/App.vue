<script setup lang="ts">
import type { HealthResponse } from './api/types'
import { computed, onMounted, shallowRef } from 'vue'
import { getHealth } from './api'

const health = shallowRef<HealthResponse | null>(null)
const error = shallowRef<string | null>(null)

const healthLabel = computed(() => {
  if (!health.value)
    return null
  return `${health.value.status}（${new Date(health.value.timestamp).toLocaleString()}）`
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
  <main class="p-4">
    <h1 class="text-lg">
      specrun
    </h1>
    <p v-if="error">
      API error: {{ error }}
    </p>
    <p v-else-if="healthLabel">
      health: {{ healthLabel }}
    </p>
    <p v-else>
      loading…
    </p>
  </main>
</template>
