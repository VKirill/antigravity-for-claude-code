<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, useTemplateRef } from 'vue'

// ── Props ──────────────────────────────────────────────────────────────────────
// Vue 3.5: destructure directly — reactive props, with defaults
const {
  title,
  count = 0,
  items = () => [],
  // {{ADD_PROPS}}
} = defineProps<{
  title: string
  count?: number
  items?: {{ITEM_TYPE}}[]
  // {{ADDITIONAL_PROP_TYPES}}
}>()

// ── Emits ─────────────────────────────────────────────────────────────────────
const emit = defineEmits<{
  change: [value: {{CHANGE_PAYLOAD_TYPE}}]
  close: []
  // {{ADDITIONAL_EMITS}}
}>()

// ── v-model (optional — delete if not a form control) ─────────────────────────
const modelValue = defineModel<{{MODEL_TYPE}}>()

// ── Local state ───────────────────────────────────────────────────────────────
const isOpen = ref(false)
const loading = ref(false)

// ── Template refs ─────────────────────────────────────────────────────────────
const rootEl = useTemplateRef<HTMLDivElement>('root')
const inputEl = useTemplateRef<HTMLInputElement>('mainInput')

// ── Computed ──────────────────────────────────────────────────────────────────
const displayTitle = computed(() => title.toUpperCase())
const hasItems = computed(() => items.length > 0)

// ── Watchers ──────────────────────────────────────────────────────────────────
watch(
  () => count,  // prop — must use getter
  (newCount) => {
    // react to prop change
  }
)

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  inputEl.value?.focus()
  // {{MOUNT_LOGIC}}
})

onUnmounted(() => {
  // cleanup: remove listeners, timers, subscriptions
  // {{CLEANUP_LOGIC}}
})

// ── Methods ───────────────────────────────────────────────────────────────────
function handleChange(value: {{CHANGE_PAYLOAD_TYPE}}) {
  emit('change', value)
}

function handleClose() {
  isOpen.value = false
  emit('close')
}

// ── Exposed API (remove if parent doesn't need access via template ref) ────────
defineExpose({
  // {{EXPOSED_METHODS_OR_STATE}}
})
</script>

<template>
  <div ref="root" class="{{COMPONENT_CLASS}}">
    <!-- Slot: named header slot with default fallback -->
    <header v-if="$slots.header || title">
      <slot name="header">
        <h2>{{ displayTitle }}</h2>
      </slot>
    </header>

    <!-- Conditional render -->
    <div v-if="loading" class="loading-state">
      <slot name="loading"><span>Loading...</span></slot>
    </div>

    <template v-else>
      <!-- List render with key -->
      <ul v-if="hasItems">
        <li v-for="item in items" :key="item.{{ID_FIELD}}">
          <!-- Default slot with scoped props -->
          <slot :item="item">{{ item }}</slot>
        </li>
      </ul>

      <p v-else>
        <slot name="empty">No items.</slot>
      </p>
    </template>

    <!-- Input bound to defineModel -->
    <input
      v-if="modelValue !== undefined"
      ref="mainInput"
      :value="modelValue"
      @input="modelValue = ($event.target as HTMLInputElement).value"
    />

    <!-- Footer actions -->
    <footer>
      <button type="button" @click="handleClose">Close</button>
      <!-- {{ADDITIONAL_ACTIONS}} -->
    </footer>
  </div>
</template>

<style scoped>
.{{COMPONENT_CLASS}} {
  /* component root styles */
}

/* Style child component root elements */
/* :deep(.child-class) { } */

/* Style slotted content */
/* :slotted(p) { } */
</style>
