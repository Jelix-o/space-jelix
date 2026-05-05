import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { chatApi, modelsApi } from '@/api'
import { DEFAULT_MODEL } from '@/types'
import type { ChatMessage, ChatSession, ModelInfo } from '@/types'

const DRAFT_ID = 'draft'
const NEW_CHAT_TITLE = '新对话'

function toSession(row: any): ChatSession {
  const dbId = Number(row.id)
  return {
    id: String(dbId),
    title: row.title || NEW_CHAT_TITLE,
    messages: [],
    modelId: row.model,
    dbId,
    pinned: !!row.pinned,
    systemPrompt: row.system_prompt || '',
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  }
}

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<ChatSession[]>([])
  const draftSession = ref<ChatSession | null>(null)
  const currentSessionId = ref<string | null>(null)
  const messages = ref<ChatMessage[]>([])
  const models = ref<ModelInfo[]>([])
  const selectedModelId = ref(DEFAULT_MODEL)
  const sending = ref(false)
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref<string | null>(null)
  const total = ref(0)
  let sendAbort: AbortController | null = null

  const currentSession = computed(() => {
    if (currentSessionId.value === DRAFT_ID) return draftSession.value
    return sessions.value.find((s) => s.id === currentSessionId.value) ?? null
  })
  const sortedSessions = computed(() =>
    [...sessions.value].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return b.updatedAt - a.updatedAt
    }),
  )
  const isDraft = computed(() => currentSessionId.value === DRAFT_ID)

  async function fetchModels() {
    models.value = await modelsApi.list().catch(() => [
      { id: DEFAULT_MODEL, name: 'MiMo V2.5 Pro', provider: 'Xiaomi (MiMo)' },
    ])
    if (!models.value.some((model) => model.id === selectedModelId.value) && models.value[0]) {
      selectedModelId.value = models.value[0].id
    }
  }

  const PAGE_SIZE = 10

  async function loadConversations(silent = false) {
    if (!silent) loading.value = true
    error.value = null
    try {
      const result = await chatApi.getConversations(PAGE_SIZE, 0)
      const fresh = result.conversations.map(toSession)
      // Merge: preserve cached messages from existing sessions
      sessions.value = fresh.map((s) => {
        const existing = sessions.value.find((e) => e.id === s.id)
        return existing ? { ...s, messages: existing.messages } : s
      })
      total.value = result.total
    } catch (e) {
      if (!silent) error.value = e instanceof Error ? e.message : String(e)
    } finally {
      if (!silent) loading.value = false
    }
  }

  async function loadMore(): Promise<boolean> {
    if (loadingMore.value || sessions.value.length >= total.value) return false
    loadingMore.value = true
    try {
      const result = await chatApi.getConversations(PAGE_SIZE, sessions.value.length)
      const newSessions = result.conversations.map(toSession)
      for (const s of newSessions) {
        if (!sessions.value.some((existing) => existing.id === s.id)) {
          sessions.value.push(s)
        }
      }
      total.value = result.total
      return newSessions.length > 0
    } catch {
      return false
    } finally {
      loadingMore.value = false
    }
  }

  const hasMore = computed(() => sessions.value.length < total.value)

  function startDraftSession() {
    draftSession.value = {
      id: DRAFT_ID,
      title: NEW_CHAT_TITLE,
      messages: [],
      modelId: selectedModelId.value,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    currentSessionId.value = DRAFT_ID
    messages.value = []
    error.value = null
    return draftSession.value
  }

  async function newSession(title = NEW_CHAT_TITLE): Promise<ChatSession> {
    const conversation = await chatApi.createConversation(title, selectedModelId.value)
    const session = toSession(conversation)
    upsertSession(session)
    currentSessionId.value = session.id
    draftSession.value = null
    messages.value = []
    return session
  }

  function cancelSend() {
    if (sendAbort) {
      sendAbort.abort()
      sendAbort = null
    }
  }

  async function selectSession(id: string | number) {
    const sessionId = String(id)
    if (sessionId === DRAFT_ID) {
      startDraftSession()
      return
    }

    if (!sessions.value.some((s) => s.id === sessionId)) {
      await loadConversations()
    }

    const session = sessions.value.find((s) => s.id === sessionId)
    currentSessionId.value = sessionId
    draftSession.value = null
    messages.value = session?.messages ?? []
    if (session?.dbId) {
      selectedModelId.value = session.modelId || selectedModelId.value
      await loadMessages(sessionId)
    }
  }

  async function loadMessages(sessionId: string) {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (!session?.dbId) return
    const rows = await chatApi.getMessages(session.dbId)
    messages.value = rows.map((m: any) => ({
      id: `db-${m.id}`,
      role: m.role,
      content: m.content,
      model: m.model,
      timestamp: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
    }))
    session.messages = [...messages.value]
  }

  async function deleteSession(id: string) {
    const session = sessions.value.find((s) => s.id === id)
    if (session?.dbId) await chatApi.deleteConversation(session.dbId)
    sessions.value = sessions.value.filter((s) => s.id !== id)
    if (currentSessionId.value === id) {
      currentSessionId.value = null
      messages.value = []
    }
  }

  async function updateSession(id: string, data: { title?: string; model?: string; pinned?: boolean; system_prompt?: string }) {
    const session = sessions.value.find((s) => s.id === id)
    if (!session?.dbId) return
    const updated = await chatApi.updateConversation(session.dbId, data)
    if (data.title !== undefined) session.title = data.title
    if (data.model !== undefined) session.modelId = data.model
    if (data.pinned !== undefined) session.pinned = !!updated.pinned
    if (data.system_prompt !== undefined) session.systemPrompt = updated.system_prompt || ''
    session.updatedAt = Date.now()
    upsertSession(session)
  }

  async function clearMessages(id: string) {
    const session = sessions.value.find((s) => s.id === id)
    if (!session?.dbId) return
    await chatApi.clearMessages(session.dbId)
    session.messages = []
    if (currentSessionId.value === id) messages.value = []
    session.updatedAt = Date.now()
    upsertSession(session)
  }

  async function generateName(id: string): Promise<string> {
    const session = sessions.value.find((s) => s.id === id)
    if (!session?.dbId) return ''
    const model = session.modelId || selectedModelId.value
    const result = await chatApi.generateName(session.dbId, model)
    session.title = result.title
    session.updatedAt = Date.now()
    upsertSession(session)
    return result.title
  }

  async function branchSession(id: string): Promise<string> {
    const session = sessions.value.find((s) => s.id === id)
    if (!session?.dbId) return ''
    const result = await chatApi.branchConversation(session.dbId)
    const newSession = toSession(result)
    upsertSession(newSession)
    return newSession.id
  }

  async function togglePin(id: string) {
    const session = sessions.value.find((s) => s.id === id)
    if (!session) return
    await updateSession(id, { pinned: !session.pinned })
  }

  async function sendMessage(content: string): Promise<{ session: ChatSession | null; created: boolean }> {
    const trimmed = content.trim()
    if (!trimmed || sending.value) return { session: currentSession.value, created: false }

    let session = currentSession.value
    let created = false
    if (!session || !session.dbId) {
      session = await newSession(trimmed.slice(0, 24) || NEW_CHAT_TITLE)
      created = true
    }

    const sendSessionId = session.id

    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    }
    const assistantMessage: ChatMessage = {
      id: `local-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      loading: true,
    }
    messages.value.push(userMessage, assistantMessage)
    session.messages = [...messages.value]
    if (!session.title || session.title === NEW_CHAT_TITLE) session.title = trimmed.slice(0, 24)

    sending.value = true
    error.value = null
    sendAbort = new AbortController()
    const signal = sendAbort.signal
    try {
      const reply = await chatApi.send(session.dbId!, trimmed, selectedModelId.value, signal)
      assistantMessage.content = reply.content
      assistantMessage.model = reply.model
    } catch (e) {
      if (signal.aborted) return { session, created }
      const message = e instanceof Error ? e.message : String(e)
      assistantMessage.content = `请求失败：${message}`
      assistantMessage.error = message
      error.value = message
    } finally {
      sendAbort = null
      assistantMessage.loading = false
      assistantMessage.timestamp = Date.now()
      // Only update session cache if still on the same session
      if (currentSessionId.value === sendSessionId) {
        session.messages = [...messages.value]
      } else {
        // User navigated away — save messages to the session object directly
        session.messages = [...session.messages]
      }
      session.updatedAt = Date.now()
      upsertSession(session)
      sending.value = false
    }

    return { session, created }
  }

  function upsertSession(session: ChatSession) {
    const index = sessions.value.findIndex((item) => item.id === session.id)
    if (index >= 0) sessions.value[index] = session
    else sessions.value.unshift(session)
  }

  return {
    DRAFT_ID,
    sessions,
    currentSessionId,
    messages,
    models,
    selectedModelId,
    sending,
    loading,
    loadingMore,
    error,
    hasMore,
    currentSession,
    sortedSessions,
    isDraft,
    fetchModels,
    loadConversations,
    loadMore,
    startDraftSession,
    newSession,
    selectSession,
    loadMessages,
    deleteSession,
    updateSession,
    clearMessages,
    generateName,
    branchSession,
    togglePin,
    sendMessage,
    cancelSend,
  }
})
