<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="visible" class="sheet-backdrop" @click.self="close">
        <div class="sheet-panel">
          <div class="sheet-header">
            <h3>选择模型</h3>
            <button class="ghost-btn" @click="close"><X :size="24" /></button>
          </div>
          <div class="sheet-body">
            <button
              v-for="option in options"
              :key="option.value"
              type="button"
              class="sheet-option"
              :class="{ active: modelValue === option.value }"
              @click="select(option.value)"
            >
              <span class="option-label">{{ option.label }}</span>
              <small v-if="option.subtitle">{{ option.subtitle }}</small>
              <Check v-if="modelValue === option.value" :size="20" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Check, X } from 'lucide-vue-next'
import { useNativeBackClose } from '@/composables/useNativeBackClose'

const props = defineProps<{
  visible: boolean
  modelValue: string
  options: { value: string; label: string; subtitle?: string }[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'update:modelValue', value: string): void
}>()

function close() {
  emit('update:visible', false)
}

function select(value: string) {
  emit('update:modelValue', value)
  emit('update:visible', false)
}

useNativeBackClose(computed(() => props.visible), close)
</script>

<style scoped>
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: flex-end;
}

.sheet-panel {
  width: 100%;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  border-radius: 24px 24px 0 0;
  background: var(--panel-strong);
  box-shadow: 0 -16px 48px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 22px 12px;
  flex-shrink: 0;
}

.sheet-header h3 {
  font-size: 1.15rem;
  font-weight: 900;
  color: var(--text-strong);
  margin: 0;
}

.sheet-body {
  overflow: auto;
  padding: 4px 12px 20px;
}

.sheet-option {
  width: 100%;
  min-height: 60px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 12px;
  align-items: center;
  border: 0;
  border-radius: 16px;
  padding: 10px 14px;
  color: var(--text-strong);
  background: transparent;
  text-align: left;
  transition: background 0.15s ease;
}

.sheet-option:active {
  background: var(--accent-soft);
}

.sheet-option.active {
  color: var(--accent);
  background: var(--accent-soft);
}

.option-label {
  grid-column: 1;
  font-weight: 800;
  font-size: 0.95rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-option small {
  grid-column: 1;
  color: var(--text);
  font-size: 0.8rem;
}

.sheet-option svg {
  grid-row: 1 / 3;
  grid-column: 2;
  color: var(--accent);
}

.sheet-enter-active,
.sheet-leave-active {
  transition: all 0.25s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateY(100%);
}
</style>
