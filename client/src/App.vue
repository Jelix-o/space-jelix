<template>
  <div class="app-shell" :class="{ 'nav-hidden': hideAppNav }">
    <aside v-if="!hideAppNav" class="side-nav">
      <RouterLink class="brand" to="/">
        <span class="brand-mark">J</span>
        <span>Space Jelix</span>
      </RouterLink>
      <nav class="nav-list">
        <RouterLink v-for="item in navItems" :key="item.to" class="nav-link" :to="item.to">
          <component :is="item.icon" :size="22" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <main class="main-stage">
      <RouterView />
    </main>

    <nav v-if="!hideAppNav" class="bottom-nav" aria-label="主导航">
      <RouterLink v-for="item in navItems" :key="item.to" class="bottom-link" :to="item.to">
        <component :is="item.icon" :size="26" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <Toast :show="toast.state.show" :message="toast.state.message" :type="toast.state.type" :duration="toast.state.duration" @update:show="toast.state.show = $event" />
    <ConfirmDialog :show="confirm.state.show" :title="confirm.state.title" :message="confirm.state.message" :type="confirm.state.type" @update:show="confirm.state.show = $event" @result="confirm.onResult" />
    <BrowserOverlay :visible="browser.state.visible" :url="browser.state.url" @update:visible="browser.state.visible = $event" />
    <ContextMenu />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { BotMessageSquare, Home, Image, Settings, TerminalSquare } from 'lucide-vue-next'
import Toast from '@/components/Toast.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import BrowserOverlay from '@/components/BrowserOverlay.vue'
import ContextMenu from '@/components/ContextMenu.vue'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { useBrowser } from '@/composables/useBrowser'

const toast = useToast()
const confirm = useConfirm()
const browser = useBrowser()

const route = useRoute()
const hideAppNav = computed(() => route.meta.hideAppNav === true)

const navItems = [
  { to: '/', label: '应用', icon: Home },
  { to: '/chat', label: '对话', icon: BotMessageSquare },
  { to: '/generate', label: '生图', icon: Image },
  { to: '/connections', label: '终端', icon: TerminalSquare },
  { to: '/settings', label: '设置', icon: Settings },
]
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  width: 100%;
  overflow-x: hidden;
}

.main-stage {
  min-height: 100vh;
  min-width: 0;
  overflow-x: hidden;
}

.side-nav {
  display: none;
}

.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 300;
  width: 100vw;
  max-width: 100vw;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  min-height: var(--nav-size);
  padding: 8px 8px max(8px, env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.86);
  border-top: 1px solid var(--border);
  backdrop-filter: blur(24px);
  box-shadow: 0 -16px 40px rgba(49, 54, 78, 0.08);
}

:root[data-theme='dark'] .bottom-nav {
  background: rgba(17, 19, 32, 0.9);
}

.bottom-link,
.nav-link {
  display: flex;
  align-items: center;
  color: var(--text);
  font-weight: 800;
  transition: color 0.18s ease, background 0.18s ease, transform 0.18s ease;
}

.bottom-link {
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  border-radius: 18px;
  font-size: 0.82rem;
  white-space: nowrap;
}

.bottom-link.router-link-active,
.nav-link.router-link-active {
  color: var(--accent);
}

.bottom-link.router-link-active::after {
  content: '';
  width: 32px;
  height: 5px;
  border-radius: 999px;
  background: var(--accent);
}

@media (min-width: 860px) {
  .app-shell {
    display: grid;
    grid-template-columns: var(--sidebar-size) minmax(0, 1fr);
  }

  .app-shell.nav-hidden {
    display: block;
  }

  .main-stage {
    min-width: 0;
  }

  .bottom-nav {
    display: none;
  }

  .side-nav {
    position: sticky;
    top: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    gap: 28px;
    padding: 28px 18px;
    border-right: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(26px);
  }

  :root[data-theme='dark'] .side-nav {
    background: rgba(17, 19, 32, 0.82);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    color: var(--text-strong);
    font-size: 1.1rem;
    font-weight: 900;
  }

  .brand-mark {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 15px;
    color: #fff;
    background: linear-gradient(135deg, var(--accent), var(--accent-2));
    box-shadow: 0 14px 26px rgba(109, 53, 246, 0.28);
  }

  .nav-list {
    display: grid;
    gap: 8px;
  }

  .nav-link {
    gap: 12px;
    min-height: 52px;
    padding: 0 14px;
    border-radius: 16px;
  }

  .nav-link:hover,
  .nav-link.router-link-active {
    background: var(--accent-soft);
  }
}
</style>
