<template>
  <Teleport to="body">
    <Transition name="browser">
      <div v-if="visible" class="browser-overlay">
        <header class="browser-bar">
          <span class="browser-url">{{ url }}</span>
          <button class="ghost-btn browser-close" @click="close"><X :size="24" /></button>
        </header>
        <iframe :src="url" class="browser-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'

defineProps<{
  visible: boolean
  url: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

function close() {
  emit('update:visible', false)
}
</script>

<style scoped>
.browser-overlay {
  position: fixed;
  inset: 0;
  z-index: 9990;
  display: flex;
  flex-direction: column;
  background: var(--panel-strong);
}

.browser-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-strong);
  backdrop-filter: blur(20px);
  flex-shrink: 0;
}

.browser-url {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-family: var(--mono);
  font-size: 0.85rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.browser-close {
  width: 44px;
  height: 44px;
  padding: 0;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.browser-frame {
  flex: 1;
  width: 100%;
  border: 0;
  background: #fff;
}

.browser-enter-active,
.browser-leave-active {
  transition: all 0.25s ease;
}

.browser-enter-from,
.browser-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
