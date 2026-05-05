import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { appsApi } from '@/api'
import type { AppCategory, AppInfo } from '@/types'

const DEFAULT_APPS: Omit<AppInfo, 'id'>[] = [
  { name: 'Hermes', icon: 'H', url: 'http://127.0.0.1:8317', description: 'Local AI Agent', category: 'ai' },
  { name: 'OpenClaw', icon: 'O', url: 'https://openclaw.ai', description: 'Open-source AI platform', category: 'ai' },
]

const HOME_APP_ALIASES = new Map([
  ['hermes', 'Hermes'],
  ['hermes agent', 'Hermes'],
  ['openclaw', 'OpenClaw'],
])

export const useAppsStore = defineStore('apps', () => {
  const apps = ref<AppInfo[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchQuery = ref('')
  const selectedCategory = ref<AppCategory>('all')

  const filteredApps = computed(() => {
    let list = apps.value
    if (selectedCategory.value !== 'all') {
      list = list.filter((app) => app.category === selectedCategory.value)
    }
    const query = searchQuery.value.trim().toLowerCase()
    if (query) {
      list = list.filter(
        (app) =>
          app.name.toLowerCase().includes(query) ||
          app.description.toLowerCase().includes(query) ||
          app.category.toLowerCase().includes(query),
      )
    }
    return list
  })

  async function fetchApps() {
    loading.value = true
    error.value = null
    try {
      let rows = await appsApi.list()
      let normalized = normalizeHomeApps(rows)
      if (!hasDefaultApps(normalized)) {
        await seedMissingApps(normalized)
        rows = await appsApi.list()
        normalized = normalizeHomeApps(rows)
      }
      apps.value = normalized
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function seedMissingApps(existing: AppInfo[]) {
    const names = new Set(existing.map((app) => app.name))
    const missing = DEFAULT_APPS.filter((app) => !names.has(app.name))
    if (missing.length === 0) return
    await Promise.all(missing.map((app) => appsApi.create(app).catch(() => undefined)))
  }

  async function addApp(app: Partial<AppInfo>) {
    const created = await appsApi.create(app)
    apps.value = normalizeHomeApps([created, ...apps.value])
    return created
  }

  async function updateApp(id: number, app: Partial<AppInfo>) {
    const updated = await appsApi.update(id, app)
    apps.value = normalizeHomeApps(apps.value.map((item) => (item.id === id ? updated : item)))
    return updated
  }

  async function removeApp(id: number) {
    await appsApi.delete(id)
    apps.value = apps.value.filter((app) => app.id !== id)
  }

  return {
    apps,
    loading,
    error,
    searchQuery,
    selectedCategory,
    filteredApps,
    fetchApps,
    addApp,
    updateApp,
    removeApp,
  }
})

function hasDefaultApps(rows: AppInfo[]) {
  const names = new Set(rows.map((app) => app.name))
  return DEFAULT_APPS.every((app) => names.has(app.name))
}

function normalizeHomeApps(rows: AppInfo[]) {
  const core = new Map<string, AppInfo>()
  const custom: AppInfo[] = []
  const seenCustomIds = new Set<number>()

  for (const app of rows) {
    if (isOldCodexTestApp(app)) continue

    const canonical = HOME_APP_ALIASES.get(app.name.trim().toLowerCase())
    if (canonical) {
      if (core.has(canonical)) continue
      const defaults = DEFAULT_APPS.find((item) => item.name === canonical)
      core.set(canonical, {
        ...app,
        name: canonical,
        icon: app.icon || defaults?.icon || '',
        description: defaults?.description ?? app.description,
        category: defaults?.category ?? app.category,
      })
      continue
    }

    if (!seenCustomIds.has(app.id)) {
      seenCustomIds.add(app.id)
      custom.push(app)
    }
  }

  const orderedCore = DEFAULT_APPS.map((app) => core.get(app.name)).filter((app): app is AppInfo => Boolean(app))
  return [...orderedCore, ...custom]
}

function isOldCodexTestApp(app: AppInfo) {
  return /^codex\b/i.test(app.name.trim())
}
