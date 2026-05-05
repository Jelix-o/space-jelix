<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="visible" class="toast-wrapper" :class="type">
        <div class="toast-content">
          <component :is="iconComponent" :size="20" />
          <span>{{ message }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-vue-next'

const props = defineProps<{
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const visible = ref(false)

const iconComponent = computed(() => {
  switch (props.type) {
    case 'success': return CheckCircle
    case 'error': return XCircle
    case 'warning': return AlertCircle
    default: return Info
  }
})

watch(() => props.show, (val) => {
  visible.value = val
  if (val && props.duration !== 0) {
    setTimeout(() => {
      visible.value = false
      emit('update:show', false)
    }, props.duration || 3000)
  }
})
</script>

<style scoped>
.toast-wrapper {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  padding: 14px 24px;
  border-radius: 12px;
  background: var(--panel-strong);
  border: 1px solid var(--border);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(20px);
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-strong);
}

.toast-wrapper.success svg { color: #22c55e; }
.toast-wrapper.error svg { color: #ef4444; }
.toast-wrapper.warning svg { color: #f59e0b; }
.toast-wrapper.info svg { color: var(--accent); }

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}
</style>
