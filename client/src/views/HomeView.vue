<template>
  <section class="page home-page">
    <header class="page-hero compact-hero">
      <div class="hero-icon"><Rocket :size="42" /></div>
      <div>
        <h1 class="page-title">Space Jelix</h1>
        <p class="page-subtitle">进入核心工作入口</p>
      </div>
    </header>

    <div class="toolbar home-toolbar">
      <div class="search-shell">
        <Search :size="20" />
        <input v-model.trim="store.searchQuery" placeholder="搜索应用..." />
      </div>
      <div class="category-tabs">
        <button
          v-for="cat in categories"
          :key="cat.value"
          type="button"
          class="category-tab"
          :class="{ active: store.selectedCategory === cat.value }"
          @click="store.selectedCategory = cat.value"
        >
          {{ cat.label }}
        </button>
      </div>
    </div>

    <div v-if="store.error" class="error-state glass-card">{{ store.error }}</div>
    <div v-else-if="store.loading" class="empty-state glass-card">正在加载...</div>
    <div v-else-if="store.filteredApps.length === 0" class="empty-state glass-card">
      {{ store.searchQuery || store.selectedCategory !== 'all' ? '没有匹配的应用' : '暂无可用入口' }}
    </div>

    <div v-else class="launcher-row">
      <button v-for="app in store.filteredApps" :key="app.id" type="button" class="launcher-card glass-card" @click="openApp(app)">
        <span class="app-icon">{{ app.icon || app.name.slice(0, 1) }}</span>
        <div class="app-content">
          <strong class="app-name">{{ app.name }}</strong>
          <small v-if="app.description" class="app-desc">{{ app.description }}</small>
        </div>
        <ExternalLink class="open-icon" :size="20" />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { ExternalLink, Rocket, Search } from 'lucide-vue-next'
import { useAppsStore } from '@/stores/apps'
import { openUrl } from '@/utils/openUrl'
import { APP_CATEGORIES } from '@/types'
import type { AppInfo } from '@/types'

const store = useAppsStore()
const categories = APP_CATEGORIES

onMounted(() => {
  if (!store.apps.length) store.fetchApps()
})

function openApp(app: AppInfo) {
  if (app.url) openUrl(app.url)
}
</script>

<style scoped>
.home-page {
  max-width: 1040px;
}

.compact-hero {
  margin-bottom: 24px;
}

.home-toolbar {
  display: grid;
  gap: 14px;
  margin-bottom: 24px;
}

.search-shell {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 52px;
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 0 16px;
  background: var(--panel-strong);
}

.search-shell svg {
  color: var(--muted);
  flex-shrink: 0;
}

.search-shell input {
  border: 0;
  background: transparent;
  min-width: 0;
  color: var(--text-strong);
}

.search-shell input::placeholder {
  color: var(--muted);
}

.category-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.category-tabs::-webkit-scrollbar {
  display: none;
}

.category-tab {
  flex-shrink: 0;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font-weight: 800;
  font-size: 0.88rem;
  white-space: nowrap;
  transition: all 0.18s ease;
}

.category-tab.active {
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  border-color: transparent;
  box-shadow: 0 8px 20px rgba(109, 53, 246, 0.22);
}

.category-tab:not(.active):hover {
  border-color: rgba(109, 53, 246, 0.3);
  color: var(--accent);
}

.launcher-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.launcher-card {
  position: relative;
  min-width: 0;
  min-height: 118px;
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  border: 1px solid var(--border);
  padding: 18px;
  color: var(--text-strong);
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.launcher-card:hover {
  transform: translateY(-2px);
  border-color: rgba(109, 53, 246, 0.34);
  box-shadow: var(--shadow);
}

.app-icon {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  border-radius: 20px;
  color: #fff;
  background: linear-gradient(145deg, var(--accent), var(--accent-2));
  box-shadow: var(--shadow-soft);
  font-size: 1.7rem;
  font-weight: 900;
}

.app-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.app-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: clamp(1.05rem, 3.8vw, 1.35rem);
  font-weight: 900;
}

.app-desc {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
  font-size: 0.85rem;
}

.open-icon {
  color: var(--accent);
}

@media (min-width: 860px) {
  .launcher-row {
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }

  .launcher-card {
    min-height: 136px;
    grid-template-columns: 68px minmax(0, 1fr) auto;
    padding: 24px;
  }

  .app-icon {
    width: 68px;
    height: 68px;
    border-radius: 22px;
    font-size: 1.9rem;
  }
}

@media (max-width: 620px) {
  .launcher-row {
    gap: 10px;
    grid-template-columns: 1fr;
  }

  .launcher-card {
    min-height: 0;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border-radius: 18px;
  }

  .app-icon {
    grid-row: auto;
    grid-column: auto;
    width: 50px;
    height: 50px;
    border-radius: 14px;
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .app-name {
    grid-column: auto;
    grid-row: auto;
    font-size: 0.95rem;
    font-weight: 800;
  }

  .app-desc {
    grid-column: auto;
    grid-row: auto;
    display: block;
    font-size: 0.78rem;
    color: var(--muted);
    margin-top: 2px;
  }

  .open-icon {
    display: none;
  }
}
</style>
