<template>
  <div ref="selectRef" class="app-select">
    <button type="button" class="select-trigger" :aria-expanded="open" @click="toggleOpen">
      <span>{{ selectedLabel }}</span>
      <ChevronDown :size="22" />
    </button>
  </div>

  <Teleport to="body">
    <div v-if="open" ref="menuRef" class="select-menu" :style="menuStyle" @pointerdown.stop>
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="select-option"
        :class="{ active: modelValue === option.value }"
        @click="selectOption(option.value)"
      >
        <span>{{ option.label }}</span>
        <small v-if="option.subtitle">{{ option.subtitle }}</small>
        <Check v-if="modelValue === option.value" :size="20" />
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'
import { useNativeBackClose } from '@/composables/useNativeBackClose'

export interface AppSelectOption {
  value: string
  label: string
  subtitle?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: AppSelectOption[]
  placeholder?: string
  placement?: 'down' | 'up'
}>(), {
  placeholder: '请选择',
  placement: 'down',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const open = ref(false)
const selectRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({})

const selectedLabel = computed(() => props.options.find((option) => option.value === props.modelValue)?.label ?? props.placeholder)

function toggleOpen() {
  open.value = !open.value
}

function selectOption(value: string) {
  emit('update:modelValue', value)
  emit('change', value)
  open.value = false
}

function close() {
  open.value = false
}

function updatePosition() {
  const trigger = selectRef.value?.querySelector('.select-trigger')
  if (!trigger) return

  const rect = trigger.getBoundingClientRect()
  const gap = 10
  const viewportPadding = 12
  const viewportHeight = window.innerHeight
  const spaceBelow = viewportHeight - rect.bottom - viewportPadding
  const spaceAbove = rect.top - viewportPadding
  const mobileMax = Math.floor(viewportHeight * 0.46)
  const preferredMax = window.innerWidth <= 760 ? Math.min(360, mobileMax) : 300
  const estimatedHeight = Math.min(preferredMax, Math.max(120, props.options.length * 64 + 16))
  const openUp = props.placement === 'up' || (spaceBelow < estimatedHeight && spaceAbove > spaceBelow)
  const available = Math.max(120, (openUp ? spaceAbove : spaceBelow) - gap)
  const maxHeight = Math.min(preferredMax, available)
  const left = Math.min(Math.max(viewportPadding, rect.left), window.innerWidth - rect.width - viewportPadding)

  menuStyle.value = {
    left: `${Math.round(left)}px`,
    width: `${Math.round(rect.width)}px`,
    maxHeight: `${Math.round(maxHeight)}px`,
    ...(openUp
      ? { top: 'auto', bottom: `${Math.round(viewportHeight - rect.top + gap)}px` }
      : { top: `${Math.round(rect.bottom + gap)}px`, bottom: 'auto' }),
  }
}

function handlePointerDown(event: PointerEvent) {
  const target = event.target as Node
  if (selectRef.value?.contains(target) || menuRef.value?.contains(target)) return
  open.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

function handleViewportChange() {
  if (open.value) updatePosition()
}

onMounted(() => {
  document.addEventListener('pointerdown', handlePointerDown)
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('scroll', handleViewportChange, true)
  window.addEventListener('resize', handleViewportChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handlePointerDown)
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('scroll', handleViewportChange, true)
  window.removeEventListener('resize', handleViewportChange)
})

watch(open, async (value) => {
  if (!value) return
  updatePosition()
  await nextTick()
  updatePosition()
})

useNativeBackClose(open, close)
</script>

<style scoped>
.app-select {
  position: relative;
  width: 100%;
  min-width: 0;
}

.select-trigger {
  width: 100%;
  min-height: 62px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 0 18px;
  color: var(--text-strong);
  background: var(--panel-strong);
  font-weight: 800;
  text-align: left;
  box-shadow: var(--shadow-soft);
}

.select-trigger span,
.select-option span,
.select-option small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-trigger svg {
  color: var(--text);
}

.select-menu {
  position: fixed;
  z-index: 760;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--panel-strong);
  box-shadow: var(--shadow);
  padding: 8px;
}

.select-option {
  width: 100%;
  min-height: 56px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 12px;
  align-items: center;
  border: 0;
  border-radius: 14px;
  padding: 8px 12px;
  color: var(--text-strong);
  background: transparent;
  text-align: left;
}

.select-option small {
  grid-column: 1;
  color: var(--text);
  font-weight: 700;
}

.select-option svg {
  grid-row: 1 / 3;
  grid-column: 2;
  color: var(--accent);
}

.select-option.active,
.select-option:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

@media (max-width: 760px) {
  .select-menu {
    max-height: min(46vh, 360px);
  }
}
</style>
