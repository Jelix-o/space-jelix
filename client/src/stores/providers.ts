import { ref } from 'vue'
import { defineStore } from 'pinia'
import { providersApi } from '@/api'
import type { ProviderInfo, ProviderModel } from '@/types'

export const useProvidersStore = defineStore('providers', () => {
  const providers = ref<ProviderInfo[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const testingIds = ref<Set<number>>(new Set())

  async function fetchProviders() {
    loading.value = true
    error.value = null
    try {
      providers.value = await providersApi.list()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function createProvider(provider: Partial<ProviderInfo>) {
    const created = await providersApi.create(provider)
    providers.value.unshift(created)
    return created
  }

  async function updateProvider(id: number, provider: Partial<ProviderInfo>) {
    const updated = await providersApi.update(id, provider)
    const index = providers.value.findIndex((item) => item.id === id)
    if (index >= 0) providers.value[index] = updated
    return updated
  }

  async function deleteProvider(id: number) {
    await providersApi.delete(id)
    providers.value = providers.value.filter((provider) => provider.id !== id)
  }

  async function testProvider(id: number) {
    testingIds.value.add(id)
    try {
      const result = await providersApi.test(id)
      const index = providers.value.findIndex((provider) => provider.id === id)
      if (index >= 0) {
        providers.value[index] = {
          ...providers.value[index],
          status: result.success ? 'connected' : 'error',
          last_tested: new Date().toISOString(),
        }
      }
      return result
    } finally {
      testingIds.value.delete(id)
    }
  }

  async function addModel(providerId: number, model: ProviderModel) {
    const created = await providersApi.addModel(providerId, model)
    const provider = providers.value.find((item) => item.id === providerId)
    if (provider) provider.models.push(created)
    return created
  }

  async function deleteModel(providerId: number, modelId: number) {
    await providersApi.deleteModel(providerId, modelId)
    const provider = providers.value.find((item) => item.id === providerId)
    if (provider) provider.models = provider.models.filter((model) => model.id !== modelId)
  }

  return {
    providers,
    loading,
    error,
    testingIds,
    fetchProviders,
    createProvider,
    updateProvider,
    deleteProvider,
    testProvider,
    addModel,
    deleteModel,
  }
})
