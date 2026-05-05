<template>
  <section class="page settings-page">
    <header class="page-hero">
      <div class="hero-icon"><Settings :size="46" /></div>
      <div>
        <h1 class="page-title">设置</h1>
        <p class="page-subtitle">{{ panelTitle }}</p>
      </div>
    </header>

    <div v-if="activePanel === 'index'" class="settings-entry-grid">
      <button v-for="entry in entries" :key="entry.key" type="button" class="entry-card glass-card" @click="openPanel(entry.key)">
        <span class="entry-icon"><component :is="entry.icon" :size="30" /></span>
        <span class="entry-copy">
          <strong>{{ entry.title }}</strong>
          <small>{{ entry.desc }}</small>
        </span>
        <span class="entry-count">{{ entry.count }}</span>
        <ChevronRight :size="24" />
      </button>
    </div>

    <template v-else>
      <div class="panel-toolbar">
        <button type="button" class="secondary-btn" @click="activePanel = 'index'"><ArrowLeft :size="22" />返回</button>
        <button v-if="activePanel === 'apps'" type="button" class="primary-btn" @click="openAppCreate"><Plus :size="22" />添加应用</button>
        <button v-if="activePanel === 'providers'" type="button" class="primary-btn" @click="openProviderCreate"><Plus :size="22" />添加服务商</button>
      </div>

      <section v-if="activePanel === 'apps'" class="manage-list">
        <div v-if="appsError" class="error-state glass-card">{{ appsError }}</div>
        <div v-else-if="appsLoading" class="empty-state glass-card">正在加载应用...</div>
        <div v-else-if="allApps.length === 0" class="empty-state glass-card">
          <p>暂无应用，点击上方按钮添加</p>
        </div>
        <article v-for="app in allApps" v-else :key="app.id" class="manage-card glass-card">
          <span class="manage-icon">{{ app.icon || app.name.slice(0, 1) }}</span>
          <span class="manage-main">
            <strong>{{ app.name }}</strong>
            <small>{{ app.url }}</small>
          </span>
          <span class="badge">{{ categoryLabel(app.category) }}</span>
          <div class="manage-actions">
            <button type="button" class="secondary-btn" @click="openAppEdit(app)"><Pencil :size="20" />编辑</button>
            <button type="button" class="danger-btn" @click="deleteApp(app)"><Trash2 :size="20" />删除</button>
          </div>
        </article>
      </section>

      <section v-if="activePanel === 'providers'" class="manage-list">
        <div v-if="providersError" class="error-state glass-card">{{ providersError }}</div>
        <div v-else-if="providersLoading" class="empty-state glass-card">正在加载服务商...</div>
        <article v-for="provider in providers" v-else :key="provider.id" class="manage-card provider-row glass-card">
          <span class="entry-icon provider-small"><PlugZap :size="26" /></span>
          <span class="manage-main">
            <strong>{{ provider.name }}</strong>
            <small>{{ provider.base_url }}</small>
          </span>
          <span class="badge">{{ providerTypeLabel(provider.type) }}</span>
          <div class="manage-actions">
            <button type="button" class="secondary-btn" @click="testProvider(provider)"><Search :size="20" />测试</button>
            <button type="button" class="secondary-btn" @click="openProviderEdit(provider)"><Pencil :size="20" />编辑</button>
            <button type="button" class="danger-btn" @click="deleteProvider(provider)"><Trash2 :size="20" />删除</button>
          </div>
        </article>
      </section>

      <form v-if="activePanel === 'preferences'" class="settings-card glass-card" @submit.prevent="savePreferences">
        <section class="setting-section">
          <div class="section-title">
            <Palette :size="28" />
            <div>
              <h2>主题</h2>
              <p>选择界面显示主题</p>
            </div>
          </div>
          <div class="theme-grid">
            <button
              v-for="option in themeOptions"
              :key="option.value"
              type="button"
              class="theme-option"
              :class="{ active: settings.theme === option.value }"
              @click="settings.theme = option.value"
            >
              <component :is="option.icon" :size="34" />
              <span>{{ option.label }}</span>
              <CheckCircle2 v-if="settings.theme === option.value" class="check" :size="24" />
            </button>
          </div>
        </section>

        <section class="setting-section">
          <div class="section-title">
            <Bot :size="28" />
            <div>
              <h2>默认模型</h2>
              <p>新对话默认使用的 AI 模型</p>
            </div>
          </div>
          <div class="model-picker">
            <ModelPicker v-model="settings.defaultModel" :models="chat.models" />
          </div>
        </section>

        <section class="setting-section">
          <div class="section-title">
            <Type :size="28" />
            <div>
              <h2>字体大小：{{ settings.fontSize }}px</h2>
              <p>调整全局字体大小</p>
            </div>
          </div>
          <input v-model.number="settings.fontSize" class="font-range" type="range" min="14" max="20" step="1" />
        </section>

        <button class="primary-btn save-btn"><Save :size="26" />保存设置</button>
        <p v-if="saved" class="saved">设置已保存</p>
      </form>
    </template>

    <Teleport to="body">
      <div v-if="appModalOpen" class="modal-backdrop" @click.self="closeAppModal">
        <form class="modal-panel entity-modal" @submit.prevent="submitApp">
          <div class="modal-header">
            <div class="modal-title"><span class="modal-badge"><AppWindow :size="28" /></span>{{ appForm.id ? '编辑应用' : '添加应用' }}</div>
            <button type="button" class="ghost-btn close-only" @click="closeAppModal"><X :size="28" /></button>
          </div>

          <div class="modal-body">
            <div class="field">
              <label>应用名称 *</label>
              <input v-model.trim="appForm.name" required placeholder="例如：我的 AI 工具" />
            </div>
            <div class="field">
              <label>描述</label>
              <textarea v-model.trim="appForm.description" placeholder="简要描述应用功能..." />
            </div>
            <div class="field">
              <label>图标</label>
              <div class="icon-grid">
                <button
                  v-for="icon in iconOptions"
                  :key="icon"
                  type="button"
                  class="icon-option"
                  :class="{ active: appForm.icon === icon }"
                  @click="appForm.icon = icon"
                >
                  {{ icon }}
                </button>
              </div>
              <input v-model.trim="appForm.icon" maxlength="4" placeholder="或输入自定义 emoji" />
            </div>
            <div class="field">
              <label>分类</label>
              <AppSelect v-model="appForm.category" :options="categoryOptions" />
            </div>
            <div class="field">
              <label>应用 URL *</label>
              <input v-model.trim="appForm.url" required type="url" placeholder="https://example.com" />
              <small class="field-hint">输入完整的网址，包含 https://</small>
            </div>
            <p v-if="modalError" class="modal-error">{{ modalError }}</p>
          </div>

          <div class="modal-actions">
            <button type="button" class="secondary-btn" @click="closeAppModal">取消</button>
            <button class="primary-btn" :disabled="submitting">{{ submitting ? '保存中...' : '保存应用' }}</button>
          </div>
        </form>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="providerModalOpen" class="modal-backdrop" @click.self="closeProviderModal">
        <form class="modal-panel entity-modal" @submit.prevent="submitProvider">
          <div class="modal-header">
            <div class="modal-title"><span class="modal-badge"><PlugZap :size="28" /></span>{{ providerForm.id ? '编辑服务商' : '添加服务商' }}</div>
            <button type="button" class="ghost-btn close-only" @click="closeProviderModal"><X :size="28" /></button>
          </div>

          <div class="modal-body">
            <div class="field">
              <label>名称</label>
              <input v-model.trim="providerForm.name" required placeholder="例如：OpenAI、Anthropic" />
            </div>
            <div class="field">
              <label>类型</label>
              <AppSelect v-model="providerForm.type" :options="providerTypeOptions" />
            </div>
            <div class="field">
              <label>API URL</label>
              <input v-model.trim="providerForm.base_url" required placeholder="https://api.openai.com/v1" />
            </div>
            <div class="field">
              <label>API Key</label>
              <input v-model.trim="providerForm.api_key" type="password" placeholder="sk-..." />
            </div>
            <div class="field">
              <label>模型列表</label>
              <div class="model-input">
                <div class="model-combobox">
                  <input type="text" style="display:none" />
                  <input
                    v-model.trim="modelDraft"
                    placeholder="输入或选择模型 ID"
                    autocomplete="one-time-code"
                    @keydown.enter.prevent="addModel"
                    @focus="remoteModels.length && (showDropdown = true)"
                    @blur="hideDropdown"
                  />
                  <ul v-if="showDropdown && filteredModels.length" class="model-dropdown">
                    <li
                      v-for="m in filteredModels"
                      :key="m.model_id"
                      @mousedown.prevent="pickModel(m)"
                    >
                      <span class="dd-id">{{ m.model_id }}</span>
                      <span v-if="m.name && m.name !== m.model_id" class="dd-name">{{ m.name }}</span>
                    </li>
                  </ul>
                </div>
                <button type="button" class="primary-btn add-model-btn" @click="addModel">添加</button>
              </div>
              <button type="button" class="secondary-btn fetch-btn" :disabled="fetchingModels" @click="fetchRemoteModels">
                <RefreshCw :size="16" :class="{ spinning: fetchingModels }" />
                {{ fetchingModels ? '获取中...' : '从服务商获取模型列表' }}
              </button>
              <div v-if="providerForm.models.length" class="model-list">
                <div v-for="model in providerForm.models" :key="model.model_id" class="model-row">
                  <div class="model-info">
                    <strong>{{ model.name || model.model_id }}</strong>
                    <small v-if="model.name && model.name !== model.model_id">{{ model.model_id }}</small>
                  </div>
                  <label class="img-check" title="生图模型">
                    <input type="checkbox" v-model="model.is_image_model" :true-value="1" :false-value="0" />
                    <ImageIcon :size="14" />
                    <span>生图</span>
                  </label>
                  <button type="button" class="remove-btn" @click="removeModel(model.model_id)">
                    <X :size="16" />
                  </button>
                </div>
              </div>
              <p v-else class="hint">暂无模型，添加后可在聊天页选择</p>
            </div>
            <p v-if="modalError" class="modal-error">{{ modalError }}</p>
          </div>

          <div class="modal-actions">
            <button type="button" class="secondary-btn" @click="closeProviderModal">取消</button>
            <button class="primary-btn" :disabled="submitting">{{ submitting ? '保存中...' : '保存服务商' }}</button>
          </div>
        </form>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch, type Component } from 'vue'
import { useRoute } from 'vue-router'
import {
  AppWindow,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  Laptop,
  Moon,
  Palette,
  Image as ImageIcon,
  Pencil,
  PlugZap,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  Trash2,
  Type,
  X,
} from 'lucide-vue-next'
import { appsApi, providersApi, settingsApi } from '@/api'
import AppSelect from '@/components/AppSelect.vue'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { useModalLock } from '@/composables/useModalLock'
import ModelPicker from '@/components/ModelPicker.vue'
import { useChatStore } from '@/stores/chat'
import { useAppsStore } from '@/stores/apps'
import { APP_CATEGORIES, PROVIDER_TYPES, type AppCategory, type AppInfo, type AppSettings, type ProviderInfo, type ProviderModel, type ProviderType, type ThemeMode } from '@/types'

type PanelKey = 'index' | 'apps' | 'providers' | 'preferences'

const route = useRoute()
const chat = useChatStore()
const appsStore = useAppsStore()
const toast = useToast()
const { confirm } = useConfirm()
const activePanel = ref<PanelKey>('index')
const saved = ref(false)
const submitting = ref(false)
const modalError = ref('')

const allApps = ref<AppInfo[]>([])
const appsLoading = ref(false)
const appsError = ref('')
const providers = ref<ProviderInfo[]>([])
const providersLoading = ref(false)
const providersError = ref('')

const appModalOpen = ref(false)
const providerModalOpen = ref(false)
const modelDraft = ref('')
const fetchingModels = ref(false)
const remoteModels = ref<{ model_id: string; name: string }[]>([])
const showDropdown = ref(false)

const filteredModels = computed(() => {
  const q = modelDraft.value.toLowerCase()
  if (!q) return remoteModels.value
  return remoteModels.value.filter(
    (m) => m.model_id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
  )
})
const settings = reactive<AppSettings>(settingsApi.get())

const iconOptions = ['🤖', '✨', '🧠', '🛠️', '💬', '🧩', '📊', '📁', '🌐', '⚡', '🔗', '🎬']
const categoriesWithoutAll = computed(() => APP_CATEGORIES.filter((cat) => cat.value !== 'all'))
const categoryOptions = computed(() => categoriesWithoutAll.value.map((cat) => ({ value: cat.value, label: cat.label })))
const providerTypeOptions = [
  { value: 'openai', label: 'OpenAI 兼容', subtitle: '兼容 /v1/chat/completions' },
  { value: 'anthropic', label: 'Anthropic', subtitle: 'Claude 原生接口' },
  { value: 'custom', label: '自定义', subtitle: '自定义服务商类型' },
]

const appForm = reactive({
  id: null as number | null,
  name: '',
  description: '',
  icon: iconOptions[0],
  url: '',
  category: 'other' as Exclude<AppCategory, 'all'>,
})

const providerForm = reactive({
  id: null as number | null,
  name: '',
  type: 'openai' as ProviderType,
  base_url: '',
  api_key: '',
  models: [] as ProviderModel[],
})

const themeOptions: { value: ThemeMode; label: string; icon: Component }[] = [
  { value: 'auto', label: '跟随系统', icon: Laptop },
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
]

const entries = computed(() => [
  { key: 'apps' as PanelKey, title: '应用管理', desc: '添加、编辑和删除应用入口', icon: AppWindow, count: `${allApps.value.length} 个` },
  { key: 'providers' as PanelKey, title: '服务商管理', desc: '管理模型服务商和模型列表', icon: PlugZap, count: `${providers.value.length} 个` },
  { key: 'preferences' as PanelKey, title: '偏好设置', desc: '主题、默认模型和字体大小', icon: SlidersHorizontal, count: settings.theme },
])

const panelTitle = computed(() => {
  if (activePanel.value === 'apps') return '管理所有应用入口'
  if (activePanel.value === 'providers') return '管理模型服务商'
  if (activePanel.value === 'preferences') return '主题、模型和显示偏好'
  return '选择要管理的项目'
})

onMounted(async () => {
  await Promise.all([chat.fetchModels(), loadApps(), loadProviders()])
  if (!chat.models.some((model) => model.id === settings.defaultModel) && chat.models[0]) {
    settings.defaultModel = chat.models[0].id
  }
  applySettings()
  const panel = route.query.panel
  if (panel === 'providers') activePanel.value = 'providers'
  if (panel === 'apps') activePanel.value = 'apps'
})

watch(settings, () => {
  applySettings()
  settingsApi.save({ ...settings })
}, { deep: true })

const anyModalOpen = computed(() => appModalOpen.value || providerModalOpen.value)
useModalLock(anyModalOpen)

function openPanel(panel: PanelKey) {
  activePanel.value = panel
}

function resolvedTheme() {
  if (settings.theme !== 'auto') return settings.theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applySettings() {
  document.documentElement.dataset.theme = resolvedTheme()
  document.documentElement.style.setProperty('--font-size', `${settings.fontSize}px`)
  chat.selectedModelId = settings.defaultModel
}

function savePreferences() {
  settingsApi.save({ ...settings })
  saved.value = true
  window.setTimeout(() => {
    saved.value = false
  }, 1800)
}

async function loadApps() {
  appsLoading.value = true
  appsError.value = ''
  try {
    allApps.value = await appsApi.list()
  } catch (e) {
    appsError.value = e instanceof Error ? e.message : String(e)
  } finally {
    appsLoading.value = false
  }
}

function openAppCreate() {
  Object.assign(appForm, { id: null, name: '', description: '', icon: iconOptions[0], url: '', category: 'other' })
  modalError.value = ''
  appModalOpen.value = true
}

function openAppEdit(app: AppInfo) {
  Object.assign(appForm, {
    id: app.id,
    name: app.name,
    description: app.description,
    icon: app.icon || iconOptions[0],
    url: app.url,
    category: app.category,
  })
  modalError.value = ''
  appModalOpen.value = true
}

function closeAppModal() {
  appModalOpen.value = false
}

async function submitApp() {
  submitting.value = true
  modalError.value = ''
  try {
    const payload = {
      name: appForm.name,
      description: appForm.description,
      icon: appForm.icon,
      url: appForm.url,
      category: appForm.category,
    }
    if (appForm.id) await appsApi.update(appForm.id, payload)
    else await appsApi.create(payload)
    closeAppModal()
    await loadApps()
    appsStore.fetchApps()
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : String(e)
  } finally {
    submitting.value = false
  }
}

async function deleteApp(app: AppInfo) {
  const ok = await confirm('删除应用', `确定删除应用”${app.name}”吗？此操作不可恢复。`, 'danger')
  if (!ok) return
  try {
    await appsApi.delete(app.id)
    await loadApps()
    appsStore.fetchApps()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '删除失败')
  }
}

function categoryLabel(category: string) {
  return APP_CATEGORIES.find((item) => item.value === category)?.label ?? category
}

async function loadProviders() {
  providersLoading.value = true
  providersError.value = ''
  try {
    providers.value = await providersApi.list()
  } catch (e) {
    providersError.value = e instanceof Error ? e.message : String(e)
  } finally {
    providersLoading.value = false
  }
}

function openProviderCreate() {
  remoteModels.value = []
  showDropdown.value = false
  Object.assign(providerForm, { id: null, name: '', type: 'openai', base_url: '', api_key: '', models: [] })
  modelDraft.value = ''
  modalError.value = ''
  providerModalOpen.value = true
}

function openProviderEdit(provider: ProviderInfo) {
  remoteModels.value = []
  showDropdown.value = false
  Object.assign(providerForm, {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    base_url: provider.base_url,
    api_key: provider.api_key ?? '',
    models: provider.models.map((model) => ({ ...model })),
  })
  modelDraft.value = ''
  modalError.value = ''
  providerModalOpen.value = true
}

function closeProviderModal() {
  providerModalOpen.value = false
}

function addModel() {
  const id = modelDraft.value.trim()
  if (!id || providerForm.models.some((model) => model.model_id === id)) return
  providerForm.models.push({ model_id: id, name: id, enabled: 1, is_image_model: isImageModel(id) ? 1 : 0 })
  modelDraft.value = ''
}

function isImageModel(modelId: string): boolean {
  return /dall-e|gpt-image|flux|stable-diffusion|sdxl|midjourney|imagen/i.test(modelId)
}

function removeModel(modelId: string) {
  providerForm.models = providerForm.models.filter((model) => model.model_id !== modelId)
}

function hideDropdown() {
  setTimeout(() => { showDropdown.value = false }, 150)
}

function pickModel(m: { model_id: string; name: string }) {
  modelDraft.value = m.model_id
  showDropdown.value = false
}

async function fetchRemoteModels() {
  if (!providerForm.id) {
    toast.warning('请先保存服务商，再获取模型列表')
    return
  }
  fetchingModels.value = true
  try {
    const result = await providersApi.fetchRemoteModels(providerForm.id)
    remoteModels.value = result.models
    showDropdown.value = true
    toast.success(`获取到 ${result.models.length} 个模型`)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '获取失败')
  } finally {
    fetchingModels.value = false
  }
}

async function submitProvider() {
  submitting.value = true
  modalError.value = ''
  try {
    const payload = {
      name: providerForm.name,
      type: providerForm.type,
      base_url: providerForm.base_url,
      api_key: providerForm.api_key,
      models: providerForm.models,
    }
    if (providerForm.id) await providersApi.update(providerForm.id, payload)
    else await providersApi.create(payload)
    closeProviderModal()
    await loadProviders()
    await chat.fetchModels()
  } catch (e) {
    modalError.value = e instanceof Error ? e.message : String(e)
  } finally {
    submitting.value = false
  }
}

async function testProvider(provider: ProviderInfo) {
  try {
    const result = await providersApi.test(provider.id)
    if (result.success) {
      toast.success(`连接成功，延迟: ${result.latency}ms`)
    } else {
      toast.error(result.message || '连接失败')
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e))
  }
  await loadProviders()
}

async function deleteProvider(provider: ProviderInfo) {
  const ok = await confirm('删除服务商', `确定删除服务商”${provider.name}”吗？关联模型也会被删除。`, 'danger')
  if (!ok) return
  try {
    await providersApi.delete(provider.id)
    await loadProviders()
    await chat.fetchModels()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '删除失败')
  }
}

function providerTypeLabel(type: ProviderType) {
  return PROVIDER_TYPES.find((t) => t.value === type)?.label ?? type
}
</script>

<style scoped>
.settings-page {
  max-width: 1120px;
}

.settings-entry-grid,
.manage-list {
  display: grid;
  gap: 16px;
}

.entry-card {
  min-width: 0;
  min-height: 92px;
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto auto;
  gap: 14px;
  align-items: center;
  border: 1px solid var(--border);
  padding: 18px;
  color: var(--text-strong);
  text-align: left;
}

.entry-icon,
.modal-badge,
.manage-icon {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  border-radius: 20px;
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: var(--shadow-soft);
  font-weight: 900;
}

.entry-copy,
.manage-main {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.entry-copy strong,
.manage-main strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text-strong);
  font-size: 1.18rem;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-copy small,
.manage-main small {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-count {
  border-radius: 999px;
  padding: 7px 12px;
  color: var(--accent);
  background: var(--accent-soft);
  font-size: 0.9rem;
  font-weight: 900;
  white-space: nowrap;
}

.panel-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.manage-card {
  min-width: 0;
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto auto;
  gap: 14px;
  align-items: center;
  padding: 18px;
}

.manage-icon {
  color: #fff;
  font-size: 1.4rem;
}

.provider-small {
  width: 54px;
  height: 54px;
}

.provider-row {
  grid-template-columns: 58px minmax(260px, 1fr) auto auto;
}

.provider-row .badge {
  justify-self: end;
}

.provider-row .manage-actions {
  flex-wrap: wrap;
  min-width: 0;
}

.provider-row .manage-actions button {
  min-width: 0;
  flex: 1 1 auto;
}

.manage-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.model-summary,
.model-summary span {
  max-width: 170px;
  overflow: hidden;
  border-radius: 999px;
  padding: 7px 11px;
  color: var(--accent);
  background: var(--accent-soft);
  font-size: 0.9rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-list {
  display: grid;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}

.model-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 6px 10px;
  border-radius: 12px;
  background: rgba(109, 53, 246, 0.04);
  border: 1px solid var(--border);
}

.model-info {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.model-info strong {
  color: var(--text-strong);
  font-size: 0.9rem;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-info small {
  color: var(--text);
  font-size: 0.78rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.img-check {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.img-check input {
  accent-color: var(--accent);
}

.img-check:has(input:checked) {
  color: var(--accent);
}

.remove-btn {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 8px;
  color: var(--text);
  background: transparent;
  cursor: pointer;
}

.remove-btn:hover {
  color: var(--danger);
  background: rgba(239, 68, 68, 0.08);
}

.entity-modal {
  display: grid;
  gap: 18px;
}

.close-only {
  width: 54px;
  min-height: 54px;
  padding: 0;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}

.icon-option {
  aspect-ratio: 1;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--panel-strong);
  font-size: 1.3rem;
}

.icon-option.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.model-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.model-combobox {
  position: relative;
}

.model-combobox input {
  width: 100%;
}

.model-dropdown {
  position: absolute;
  z-index: 10;
  bottom: 100%;
  left: 0;
  right: 0;
  max-height: 220px;
  overflow-y: auto;
  margin: 0 0 4px;
  padding: 4px;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--panel-strong);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.12);
}

.model-dropdown li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 6px 12px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.88rem;
  transition: background 0.12s;
}

.model-dropdown li:hover {
  background: var(--accent-soft);
}

.dd-id {
  font-weight: 800;
  color: var(--text-strong);
}

.dd-name {
  color: var(--text);
  font-size: 0.82rem;
}

.add-model-btn {
  white-space: nowrap;
}

.fetch-btn {
  width: 100%;
  white-space: nowrap;
}

.fetch-btn .spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.hint {
  color: var(--muted);
}

.field-hint {
  color: var(--muted);
  font-size: 0.8rem;
  margin-top: 4px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.modal-error {
  color: var(--danger);
  font-weight: 800;
}

.settings-card {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  display: grid;
  gap: 26px;
  padding: 34px;
  overflow: visible;
}

.setting-section {
  min-width: 0;
  display: grid;
  gap: 18px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.setting-section:last-of-type {
  border-bottom: 0;
}

.section-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 18px;
  color: var(--text-strong);
}

.section-title svg {
  color: var(--accent);
}

.section-title h2 {
  font-size: 1.35rem;
  font-weight: 900;
}

.theme-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.theme-option {
  position: relative;
  min-height: 112px;
  display: grid;
  place-items: center;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 22px;
  color: var(--text);
  background: var(--panel-strong);
  font-weight: 900;
}

.theme-option.active {
  color: var(--accent);
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent), var(--shadow-soft);
}

.check {
  position: absolute;
  bottom: 12px;
  right: 12px;
  color: var(--accent);
}

.model-picker {
  position: relative;
  width: 100%;
  min-width: 0;
}

.model-trigger {
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
}

.model-trigger span,
.model-option span,
.model-option small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-menu {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 10px);
  z-index: 360;
  max-height: 300px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--panel-strong);
  box-shadow: var(--shadow);
  padding: 8px;
}

.model-option {
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

.model-option small {
  grid-column: 1;
  color: var(--text);
}

.model-option svg {
  grid-row: 1 / 3;
  grid-column: 2;
  color: var(--accent);
}

.model-option.active,
.model-option:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

.font-range {
  width: 100%;
  accent-color: var(--accent);
}

.save-btn {
  min-height: 68px;
}

.saved {
  text-align: center;
  color: var(--success);
  font-weight: 900;
}

@media (min-width: 1040px) {
  .settings-entry-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .entry-card {
    min-height: 164px;
    grid-template-columns: 58px minmax(0, 1fr);
    grid-template-rows: auto 1fr auto;
  }

  .entry-card > svg {
    grid-column: 2;
    justify-self: end;
  }

  .entry-count {
    grid-column: 1 / -1;
    width: fit-content;
  }
}

@media (max-width: 1040px) {
  .provider-row {
    grid-template-columns: 58px minmax(0, 1fr) auto;
  }

  .provider-row .manage-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
}

@media (max-width: 760px) {
  .entry-card,
  .manage-card {
    grid-template-columns: 48px minmax(0, 1fr) auto;
    gap: 10px;
    padding: 14px;
  }

  .entry-icon,
  .modal-badge,
  .manage-icon {
    width: 48px;
    height: 48px;
    border-radius: 16px;
  }

  .entry-count,
  .manage-card > .badge {
    display: none;
  }

  .manage-main strong {
    font-size: 1rem;
  }

  .manage-main small {
    font-size: 0.8rem;
  }

  .manage-actions {
    grid-column: 1 / -1;
    display: flex;
    gap: 8px;
  }

  .manage-actions button {
    flex: 1;
    min-height: 40px;
    font-size: 0.85rem;
  }

  .provider-row .manage-actions {
    grid-template-columns: repeat(3, 1fr);
  }

  .panel-toolbar {
    display: grid;
    grid-template-columns: 1fr;
  }

  .theme-grid,
  .icon-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .settings-card {
    padding: 22px;
    border-radius: 24px;
  }

  .model-menu {
    top: auto;
    bottom: calc(100% + 10px);
    max-height: min(46vh, 360px);
  }
}
</style>
