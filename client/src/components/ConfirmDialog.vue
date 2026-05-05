<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="visible" class="confirm-backdrop" @click.self="cancel">
        <div class="confirm-panel">
          <div class="confirm-header">
            <div class="confirm-icon" :class="type">
              <AlertTriangle v-if="type === 'warning'" :size="28" />
              <XCircle v-else-if="type === 'danger'" :size="28" />
              <HelpCircle v-else :size="28" />
            </div>
            <h3>{{ title }}</h3>
          </div>
          <p class="confirm-message">{{ message }}</p>
          <div class="confirm-actions">
            <button type="button" class="secondary-btn" @click="cancel">取消</button>
            <button type="button" :class="type === 'danger' ? 'danger-btn' : 'primary-btn'" @click="confirm">
              确定
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { AlertTriangle, HelpCircle, XCircle } from 'lucide-vue-next'
import { useNativeBackClose } from '@/composables/useNativeBackClose'

const props = defineProps<{
  title: string
  message: string
  type?: 'warning' | 'danger' | 'info'
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'result', value: boolean): void
}>()

const visible = ref(false)

watch(() => props.show, (val) => {
  visible.value = val
})

function confirm() {
  visible.value = false
  emit('update:show', false)
  emit('result', true)
}

function cancel() {
  visible.value = false
  emit('update:show', false)
  emit('result', false)
}

useNativeBackClose(visible, cancel)
</script>

<style scoped>
.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(8px);
}

.confirm-panel {
  width: min(100%, 400px);
  padding: 28px;
  border-radius: 24px;
  background: var(--panel-strong);
  border: 1px solid var(--border);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.2);
}

.confirm-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.confirm-icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 16px;
}

.confirm-icon.warning {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.confirm-icon.danger {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}

.confirm-icon.info {
  background: var(--accent-soft);
  color: var(--accent);
}

.confirm-header h3 {
  font-size: 1.2rem;
  font-weight: 900;
  color: var(--text-strong);
  margin: 0;
}

.confirm-message {
  color: var(--text);
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 0 0 24px;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.confirm-enter-active,
.confirm-leave-active {
  transition: all 0.25s ease;
}

.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}

.confirm-enter-from .confirm-panel,
.confirm-leave-to .confirm-panel {
  transform: scale(0.95);
}
</style>
