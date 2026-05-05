import { ref } from 'vue'
import { defineStore } from 'pinia'
import { terminalsApi } from '@/api'
import type { TerminalConnectionInfo } from '@/types'

export const useConnectionsStore = defineStore('connections', () => {
  const connections = ref<TerminalConnectionInfo[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const testingIds = ref<Set<number>>(new Set())

  async function fetchConnections() {
    loading.value = true
    error.value = null
    try {
      connections.value = await terminalsApi.list()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function createConnection(conn: Partial<TerminalConnectionInfo>) {
    const created = await terminalsApi.create(conn)
    connections.value.unshift(created)
    return created
  }

  async function updateConnection(id: number, conn: Partial<TerminalConnectionInfo>) {
    const updated = await terminalsApi.update(id, conn)
    const index = connections.value.findIndex((item) => item.id === id)
    if (index >= 0) connections.value[index] = updated
    return updated
  }

  async function testConnection(id: number) {
    testingIds.value.add(id)
    try {
      const result = await terminalsApi.test(id)
      const index = connections.value.findIndex((item) => item.id === id)
      if (index >= 0) {
        connections.value[index] = {
          ...connections.value[index],
          status: result.status === 'reachable' ? 'reachable' : 'error',
          updated_at: new Date().toISOString(),
          last_error: result.status === 'reachable' ? '' : result.message,
        }
      }
      return result
    } finally {
      testingIds.value.delete(id)
    }
  }

  async function deleteConnection(id: number) {
    await terminalsApi.delete(id)
    connections.value = connections.value.filter((conn) => conn.id !== id)
  }

  async function uploadKey(id: number, file: File) {
    const result = await terminalsApi.uploadKey(id, file)
    const index = connections.value.findIndex((c) => c.id === id)
    if (index >= 0) connections.value[index] = result.connection
    return result
  }

  async function deleteKey(id: number) {
    const result = await terminalsApi.deleteKey(id)
    const index = connections.value.findIndex((c) => c.id === id)
    if (index >= 0) connections.value[index] = result.connection
    return result
  }

  return {
    connections,
    loading,
    error,
    testingIds,
    fetchConnections,
    createConnection,
    updateConnection,
    testConnection,
    deleteConnection,
    uploadKey,
    deleteKey,
  }
})
