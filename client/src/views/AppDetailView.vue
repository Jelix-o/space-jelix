<template>
  <section class="page detail-page">
    <header class="page-hero">
      <button class="ghost-btn" @click="goBack"><ArrowLeft :size="22" />返回</button>
    </header>

    <div v-if="loading" class="empty-state glass-card">正在加载...</div>
    <div v-else-if="error || !app" class="error-state glass-card">{{ error ?? '应用未找到' }}</div>

    <template v-else>
      <header class="detail-hero glass-card">
        <span class="detail-icon">{{ app.icon || app.name.slice(0, 1) }}</span>
        <div class="detail-info">
          <h1>{{ app.name }}</h1>
          <p v-if="categoryInfo" class="detail-category"><span class="badge">{{ categoryInfo.label }}</span></p>
        </div>
      </header>

      <section v-if="app.description" class="detail-section glass-card">
        <h2><FileText :size="22" />描述</h2>
        <p class="detail-desc">{{ app.description }}</p>
      </section>

      <section class="detail-section glass-card">
        <h2><Info :size="22" />信息</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">分类</span>
            <span class="info-value">{{ categoryInfo?.label ?? app.category }}</span>
          </div>
          <div v-if="app.url" class="info-item">
            <span class="info-label">链接</span>
            <span class="info-value mono">{{ app.url }}</span>
          </div>
          <div v-if="app.created_at" class="info-item">
            <span class="info-label">创建时间</span>
            <span class="info-value">{{ app.created_at }}</span>
          </div>
          <div v-if="app.updated_at" class="info-item">
            <span class="info-label">更新时间</span>
            <span class="info-value">{{ app.updated_at }}</span>
          </div>
        </div>
      </section>

      <section class="detail-actions">
        <button v-if="app.url" class="primary-btn" @click="handleOpenUrl"><ExternalLink :size="22" />访问应用</button>
        <button class="secondary-btn" @click="goChat"><MessageSquare :size="22" />开始对话</button>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ExternalLink, FileText, Info, MessageSquare } from 'lucide-vue-next'
import type { AppInfo } from '@/types'
import { APP_CATEGORIES } from '@/types'
import { appsApi } from '@/api'
import { openUrl } from '@/utils/openUrl'
import { useAppsStore } from '@/stores/apps'

const route = useRoute()
const router = useRouter()
const appsStore = useAppsStore()

const app = ref<AppInfo | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const appId = computed(() => Number(route.params.id))

const categoryInfo = computed(() => {
  if (!app.value) return null
  return APP_CATEGORIES.find((c) => c.value === app.value!.category)
})

onMounted(async () => {
  loading.value = true
  try {
    app.value = await appsApi.get(appId.value)
  } catch {
    await appsStore.fetchApps()
    app.value = appsStore.apps.find((a) => a.id === appId.value) ?? null
  }
  if (!app.value) error.value = '应用未找到'
  loading.value = false
})

function goBack() {
  router.push({ name: 'home' })
}

function goChat() {
  router.push({ name: 'chat' })
}

function handleOpenUrl() {
  if (app.value?.url) {
    openUrl(app.value.url)
  }
}
</script>

<style scoped>
.detail-page {
  max-width: 920px;
}

.detail-page > .page-hero {
  margin-bottom: 20px;
}

.detail-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 20px;
  align-items: center;
  padding: 28px;
  margin-bottom: 20px;
}

.detail-icon {
  width: 76px;
  height: 76px;
  display: grid;
  place-items: center;
  border-radius: 24px;
  color: #fff;
  background: linear-gradient(145deg, var(--accent), var(--accent-2));
  box-shadow: var(--shadow-soft);
  font-size: 2rem;
  font-weight: 900;
}

.detail-info h1 {
  color: var(--text-strong);
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  font-weight: 900;
}

.detail-category {
  margin-top: 10px;
}

.detail-section {
  padding: 24px;
  margin-bottom: 20px;
}

.detail-section h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-strong);
  font-size: 1.2rem;
  font-weight: 900;
  margin-bottom: 14px;
}

.detail-section h2 svg {
  color: var(--accent);
}

.detail-desc {
  color: var(--text);
  line-height: 1.7;
  font-size: 1rem;
}

.info-grid {
  display: grid;
  gap: 14px;
}

.info-item {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 12px;
  align-items: baseline;
}

.info-label {
  color: var(--muted);
  font-weight: 800;
  font-size: 0.9rem;
}

.info-value {
  color: var(--text-strong);
  font-weight: 700;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-value.mono {
  font-family: var(--mono);
  font-size: 0.9rem;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

@media (max-width: 640px) {
  .detail-hero {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
    padding: 24px;
  }

  .detail-icon {
    width: 64px;
    height: 64px;
    border-radius: 20px;
    font-size: 1.6rem;
  }

  .info-item {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .detail-actions {
    flex-direction: column;
  }

  .detail-actions button {
    width: 100%;
  }
}
</style>
