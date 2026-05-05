<template>
  <Teleport to="body">
    <Transition name="ctx">
      <div v-if="state.visible" class="ctx-backdrop" @click="hide" @contextmenu.prevent="hide">
        <div class="ctx-menu" :style="menuStyle" @click.stop>
          <button
            v-for="(action, i) in state.actions"
            :key="i"
            type="button"
            class="ctx-option"
            :class="{ danger: action.danger }"
            @click="run(action)"
          >
            <component v-if="action.icon" :is="action.icon" :size="18" />
            <span>{{ action.label }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useContextMenu } from '@/composables/useContextMenu'

const { state, hide, close } = useContextMenu()

const menuStyle = computed(() => ({
  left: `${state.x}px`,
  top: `${state.y}px`,
}))

function run(action: { handler: () => void }) {
  close()
  action.handler()
}
</script>

<style scoped>
.ctx-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

.ctx-menu {
  position: fixed;
  min-width: 160px;
  padding: 6px;
  border-radius: 16px;
  background: var(--panel-strong);
  border: 1px solid var(--border);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(20px);
}

.ctx-option {
  width: 100%;
  min-height: 46px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  border-radius: 12px;
  padding: 0 14px;
  color: var(--text-strong);
  background: transparent;
  font-size: 0.92rem;
  font-weight: 700;
  text-align: left;
  transition: background 0.12s;
}

.ctx-option:active {
  background: var(--accent-soft);
}

.ctx-option.danger {
  color: #ef4444;
}

.ctx-option.danger:active {
  background: rgba(239, 68, 68, 0.1);
}

.ctx-enter-active,
.ctx-leave-active {
  transition: all 0.15s ease;
}

.ctx-enter-from,
.ctx-leave-to {
  opacity: 0;
}

.ctx-enter-from .ctx-menu,
.ctx-leave-to .ctx-menu {
  transform: scale(0.92);
}
</style>
