import { DEFAULT_MODEL } from '@/types'
import type {
  AppInfo,
  AppSettings,
  ConnectionInfo,
  ModelInfo,
  ProviderInfo,
  ProviderModel,
  TerminalConnectionInfo,
} from '@/types'

const DEFAULT_BASE = import.meta.env.VITE_API_URL ?? ''
let cachedBaseUrl: string | null = null

export function invalidateBaseUrlCache() {
  cachedBaseUrl = null
}

export function getBaseUrl(): string {
  if (cachedBaseUrl !== null) return cachedBaseUrl
  try {
    const saved = localStorage.getItem('hermes-hub-settings')
    if (saved) {
      const settings: AppSettings = JSON.parse(saved)
      if (settings.apiBaseUrl) {
        cachedBaseUrl = settings.apiBaseUrl.replace(/\/$/, '')
        return cachedBaseUrl
      }
    }
  } catch {
    // Ignore malformed local settings.
  }
  const base = DEFAULT_BASE.replace(/\/$/, '') || ''
  cachedBaseUrl = base
  return base
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? body.message ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}

export const appsApi = {
  list: async (params: { category?: string; search?: string } = {}): Promise<AppInfo[]> => {
    const query = new URLSearchParams()
    if (params.category && params.category !== 'all') query.set('category', params.category)
    if (params.search) query.set('search', params.search)
    const suffix = query.toString() ? `?${query.toString()}` : ''
    const data = await request<{ apps: AppInfo[] }>(`/api/apps${suffix}`)
    return data.apps ?? []
  },
  get: (id: number) => request<{ app: AppInfo }>(`/api/apps/${id}`).then((r) => r.app),
  create: (app: Partial<AppInfo>) =>
    request<{ app: AppInfo }>('/api/apps', { method: 'POST', body: JSON.stringify(app) }).then((r) => r.app),
  update: (id: number, app: Partial<AppInfo>) =>
    request<{ app: AppInfo }>(`/api/apps/${id}`, { method: 'PUT', body: JSON.stringify(app) }).then((r) => r.app),
  delete: (id: number) => request<{ success: boolean }>(`/api/apps/${id}`, { method: 'DELETE' }),
}

export const chatApi = {
  createConversation: async (title?: string, model?: string) => {
    const data = await request<{ conversation: { id: number; title: string; model: string; created_at?: string; updated_at?: string } }>(
      '/api/chat/conversations',
      { method: 'POST', body: JSON.stringify({ title, model }) },
    )
    return data.conversation
  },
  getConversations: async (limit = 10, offset = 0) => {
    const data = await request<{ conversations: any[]; total: number }>(`/api/chat/conversations?limit=${limit}&offset=${offset}`)
    return { conversations: data.conversations ?? [], total: data.total ?? 0 }
  },
  getMessages: async (conversationId: number) => {
    const data = await request<{ messages: any[] }>(`/api/chat/conversations/${conversationId}/messages`)
    return data.messages ?? []
  },
  send: (
    conversationId: number,
    content: string,
    model?: string,
    signal?: AbortSignal,
  ): Promise<{ role: string; content: string; model: string }> =>
    request(`/api/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, model }),
      signal,
    }),
  updateConversation: (conversationId: number, data: { title?: string; model?: string; pinned?: boolean; system_prompt?: string }) =>
    request<{ conversation: any }>(`/api/chat/conversations/${conversationId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then((r) => r.conversation),
  clearMessages: (conversationId: number) =>
    request<{ success: boolean }>(`/api/chat/conversations/${conversationId}/messages`, { method: 'DELETE' }),
  generateName: (conversationId: number, model?: string) =>
    request<{ title: string }>(`/api/chat/conversations/${conversationId}/generate-name`, {
      method: 'POST',
      body: JSON.stringify({ model }),
    }),
  branchConversation: (conversationId: number) =>
    request<{ conversation: any }>(`/api/chat/conversations/${conversationId}/branch`, { method: 'POST' }),
  deleteConversation: (conversationId: number) =>
    request<{ success: boolean }>(`/api/chat/conversations/${conversationId}`, { method: 'DELETE' }),
}

export const modelsApi = {
  list: async (): Promise<ModelInfo[]> => {
    const data = await request<{ models: ModelInfo[] }>('/api/chat/models')
    return data.models ?? []
  },
}

export const settingsApi = {
  get: (): AppSettings => {
    const defaults: AppSettings = {
      apiBaseUrl: DEFAULT_BASE,
      theme: 'auto',
      defaultModel: DEFAULT_MODEL,
      fontSize: 16,
    }
    try {
      const saved = localStorage.getItem('hermes-hub-settings')
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults
    } catch {
      return defaults
    }
  },
  save: (settings: AppSettings) => {
    localStorage.setItem('hermes-hub-settings', JSON.stringify(settings))
    invalidateBaseUrlCache()
  },
}

export const hermesApi = {
  list: async (): Promise<ConnectionInfo[]> => {
    const data = await request<{ connections: ConnectionInfo[] }>('/api/hermes/connections')
    return data.connections ?? []
  },
  create: (conn: Partial<ConnectionInfo>) =>
    request<{ connection: ConnectionInfo }>('/api/hermes/connections', {
      method: 'POST',
      body: JSON.stringify(conn),
    }).then((r) => r.connection),
  update: (id: number, conn: Partial<ConnectionInfo>) =>
    request<{ connection: ConnectionInfo }>(`/api/hermes/connections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(conn),
    }).then((r) => r.connection),
  test: (id: number) =>
    request<{ status: string; statusCode?: number; message?: string }>(`/api/hermes/connections/${id}/test`, {
      method: 'POST',
    }),
  delete: (id: number) => request<{ success: boolean }>(`/api/hermes/connections/${id}`, { method: 'DELETE' }),
  chatWithModel: (id: number, messages: { role: string; content: string }[], model?: string) =>
    request(`/api/hermes/connections/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ messages, model }),
    }),
}

export const terminalsApi = {
  list: async (): Promise<TerminalConnectionInfo[]> => {
    const data = await request<{ connections: TerminalConnectionInfo[] }>('/api/terminals')
    return data.connections ?? []
  },
  create: (conn: Partial<TerminalConnectionInfo>) =>
    request<{ connection: TerminalConnectionInfo }>('/api/terminals', {
      method: 'POST',
      body: JSON.stringify(conn),
    }).then((r) => r.connection),
  update: (id: number, conn: Partial<TerminalConnectionInfo>) =>
    request<{ connection: TerminalConnectionInfo }>(`/api/terminals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(conn),
    }).then((r) => r.connection),
  test: (id: number) =>
    request<{ status: string; message?: string }>(`/api/terminals/${id}/test`, { method: 'POST' }),
  delete: (id: number) => request<{ success: boolean }>(`/api/terminals/${id}`, { method: 'DELETE' }),
  uploadKey: async (id: number, file: File): Promise<{ connection: TerminalConnectionInfo; keyName: string }> => {
    const formData = new FormData()
    formData.append('key', file)
    const res = await fetch(`${getBaseUrl()}/api/terminals/${id}/upload-key`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `HTTP ${res.status}`)
    }
    return res.json()
  },
  deleteKey: (id: number) =>
    request<{ connection: TerminalConnectionInfo }>(`/api/terminals/${id}/key`, { method: 'DELETE' }),
}

export const providersApi = {
  list: async (): Promise<ProviderInfo[]> => {
    const data = await request<{ providers: ProviderInfo[] }>('/api/providers')
    return data.providers ?? []
  },
  create: (provider: Partial<ProviderInfo>) =>
    request<{ provider: ProviderInfo }>('/api/providers', {
      method: 'POST',
      body: JSON.stringify(provider),
    }).then((r) => r.provider),
  update: (id: number, provider: Partial<ProviderInfo>) =>
    request<{ provider: ProviderInfo }>(`/api/providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(provider),
    }).then((r) => r.provider),
  delete: (id: number) => request<{ success: boolean }>(`/api/providers/${id}`, { method: 'DELETE' }),
  test: (id: number) =>
    request<{ success: boolean; message?: string; latency?: number }>(`/api/providers/${id}/test`, { method: 'POST' }),
  addModel: (providerId: number, model: ProviderModel) =>
    request<{ model: ProviderModel }>(`/api/providers/${providerId}/models`, {
      method: 'POST',
      body: JSON.stringify(model),
    }).then((r) => r.model),
  deleteModel: (providerId: number, modelId: number) =>
    request<{ success: boolean }>(`/api/providers/${providerId}/models/${modelId}`, { method: 'DELETE' }),
  fetchRemoteModels: (providerId: number) =>
    request<{ models: { model_id: string; name: string }[] }>(`/api/providers/${providerId}/fetch-models`, { method: 'POST' }),
}

export const imagesApi = {
  generate: (model: string, prompt: string, size?: string) =>
    request<{ id: number; url: string; model: string; prompt: string; size: string }>('/api/images/generate', {
      method: 'POST',
      body: JSON.stringify({ model, prompt, size }),
    }),
  list: () => request<{ images: { id: number; model: string; prompt: string; size: string; url: string; created_at: string }[] }>('/api/images'),
}
