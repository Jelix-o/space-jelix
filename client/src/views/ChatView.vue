<template>
  <section class="page chat-list-page">
    <header class="page-hero">
      <div class="hero-icon"><BotMessageSquare :size="44" /></div>
      <div>
        <h1 class="page-title">对话</h1>
        <p class="page-subtitle">新建对话，或继续之前的会话</p>
      </div>
    </header>

    <section class="chat-start glass-card">
      <div class="start-copy">
        <span class="start-icon"><Sparkles :size="28" /></span>
        <div>
          <h2>开始一次新对话</h2>
          <p>发送第一条消息后才会保存到历史列表</p>
        </div>
      </div>
      <ModelPicker v-model="chat.selectedModelId" :models="chat.models" />
      <button class="primary-btn new-chat-btn" @click="startNew"><Plus :size="24" />新建对话</button>
    </section>

    <section class="history-section">
      <div class="section-heading">
        <h2>历史对话</h2>
        <button class="ghost-btn refresh-btn" :disabled="chat.loading" @click="refresh"><RefreshCw :size="20" />刷新</button>
      </div>

      <div v-if="chat.error" class="error-state glass-card">{{ chat.error }}</div>
      <div v-else-if="chat.loading" class="empty-state glass-card">正在加载对话...</div>
      <div v-else-if="chat.sortedSessions.length === 0" class="empty-state glass-card">还没有历史对话</div>

      <div v-else class="session-list">
        <button
          v-for="session in chat.sortedSessions"
          :key="session.id"
          class="session-card glass-card"
          :class="{ pinned: session.pinned }"
          @click="openSession(session.id)"
          @contextmenu.prevent="openCtx($event, session)"
          @touchstart.passive="ctx.onTouchStart($event, getActions(session))"
          @touchmove.passive="ctx.onTouchMove"
          @touchend.passive="ctx.onTouchEnd"
          @mousedown="ctx.onMouseDown($event, getActions(session))"
          @mousemove="ctx.onMouseMove"
          @mouseup="ctx.onMouseUp"
        >
          <span class="session-icon"><MessageSquareText :size="24" /></span>
          <span class="session-main">
            <template v-if="editingId === session.id">
              <input
                ref="editInputRef"
                v-model="editTitle"
                class="inline-edit"
                @click.stop
                @keydown.enter="saveRename(session.id)"
                @keydown.escape="editingId = null"
                @blur="saveRename(session.id)"
              />
            </template>
            <template v-else>
              <strong>
                <Pin v-if="session.pinned" :size="14" class="pin-icon" />
                {{ session.title || '新对话' }}
              </strong>
            </template>
            <small>{{ session.modelId || '默认模型' }} · {{ formatTime(session.updatedAt) }}</small>
          </span>
          <ChevronRight :size="24" />
        </button>

        <button
          v-if="chat.hasMore"
          class="load-more-btn"
          :disabled="chat.loadingMore"
          @click="loadMore"
        >
          {{ chat.loadingMore ? '加载中...' : '加载更多' }}
        </button>
      </div>

      <Teleport to="body">
        <div v-if="promptOpen" class="modal-backdrop" @click.self="promptOpen = false">
          <div class="modal-panel prompt-modal">
            <div class="modal-header">
              <div class="modal-title"><FileText :size="22" />对话提示词</div>
              <button class="ghost-btn close-only" @click="promptOpen = false"><X :size="24" /></button>
            </div>
            <div class="modal-body">
              <textarea v-model="promptText" rows="6" placeholder="设置系统提示词，指导 AI 的行为方式..." />
            </div>
            <div class="modal-actions">
              <button class="secondary-btn" @click="promptOpen = false">取消</button>
              <button class="primary-btn" @click="savePrompt">保存</button>
            </div>
          </div>
        </div>
      </Teleport>
    </section>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  BotMessageSquare,
  ChevronRight,
  Copy,
  Download,
  Eraser,
  FileText,
  GitBranch,
  MessageSquareText,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-vue-next'
import ModelPicker from '@/components/ModelPicker.vue'
import { useChatStore } from '@/stores/chat'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useContextMenu } from '@/composables/useContextMenu'
import { useNativeBackClose } from '@/composables/useNativeBackClose'

const router = useRouter()
const chat = useChatStore()
const { confirm } = useConfirm()
const toast = useToast()
const ctx = useContextMenu()

const editingId = ref<string | null>(null)
const editTitle = ref('')
const promptOpen = ref(false)
const promptSessionId = ref<string | null>(null)
const promptText = ref('')

useNativeBackClose(promptOpen, () => {
  promptOpen.value = false
})

onMounted(() => {
  // If we already have cached sessions, show them immediately and refresh in background
  if (chat.sessions.length > 0) {
    chat.fetchModels()
    chat.loadConversations(true)
  } else {
    refresh()
  }
})

async function refresh() {
  await chat.fetchModels()
  await chat.loadConversations()
}

async function loadMore() {
  await chat.loadMore()
}

function startNew() {
  chat.startDraftSession()
  router.push('/chat/new')
}

function openSession(id: string) {
  if (editingId.value) return
  router.push(`/chat/${id}`)
}

function getActions(session: { id: string; title?: string; pinned?: boolean }) {
  return [
    { label: '生成对话名', icon: WandSparkles, handler: () => doGenerateName(session.id) },
    { label: '编辑对话名', icon: Pencil, handler: () => startRename(session) },
    { label: '对话提示词', icon: FileText, handler: () => openPrompt(session.id) },
    { label: session.pinned ? '取消置顶' : '置顶对话', icon: session.pinned ? PinOff : Pin, handler: () => doTogglePin(session.id) },
    { label: '生成新分支', icon: GitBranch, handler: () => doBranch(session.id) },
    { label: '清空消息', icon: Eraser, handler: () => doClearMessages(session.id, session.title) },
    { label: '复制文本', icon: Copy, handler: () => doCopy(session.id) },
    { label: '导出对话', icon: Download, handler: () => doExport(session.id) },
    { label: '删除对话', icon: Trash2, danger: true, handler: () => doDelete(session.id, session.title) },
  ]
}

function openCtx(e: MouseEvent | TouchEvent, session: { id: string; title?: string; pinned?: boolean }) {
  ctx.show(e, getActions(session))
}

function startRename(session: { id: string; title?: string }) {
  editingId.value = session.id
  editTitle.value = session.title || ''
  nextTick(() => {
    const input = document.querySelector('.inline-edit') as HTMLInputElement
    input?.focus()
    input?.select()
  })
}

async function saveRename(id: string) {
  const title = editTitle.value.trim()
  editingId.value = null
  if (!title) return
  try {
    await chat.updateSession(id, { title })
    toast.success('已重命名')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '重命名失败')
  }
}

async function doGenerateName(id: string) {
  try {
    toast.info('正在生成名称...')
    const name = await chat.generateName(id)
    toast.success(`已命名为：${name}`)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '生成失败')
  }
}

function openPrompt(id: string) {
  const session = chat.sessions.find((s) => s.id === id)
  promptSessionId.value = id
  promptText.value = session?.systemPrompt || ''
  promptOpen.value = true
}

async function savePrompt() {
  if (!promptSessionId.value) return
  try {
    await chat.updateSession(promptSessionId.value, { system_prompt: promptText.value })
    promptOpen.value = false
    toast.success('提示词已保存')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '保存失败')
  }
}

async function doBranch(id: string) {
  try {
    const newId = await chat.branchSession(id)
    if (newId) {
      toast.success('已生成新分支')
      router.push(`/chat/${newId}`)
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '分支失败')
  }
}

async function doTogglePin(id: string) {
  try {
    await chat.togglePin(id)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function doClearMessages(id: string, title?: string) {
  const ok = await confirm('清空消息', `确定清空对话"${title || '新对话'}"的所有消息吗？`, 'warning')
  if (!ok) return
  try {
    await chat.clearMessages(id)
    toast.success('消息已清空')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '清空失败')
  }
}

async function doCopy(id: string) {
  const session = chat.sessions.find((s) => s.id === id)
  if (!session) return
  try {
    await chat.loadMessages(id)
  } catch {}
  const msgs = chat.messages.length ? chat.messages : session.messages
  if (msgs.length === 0) {
    toast.warning('没有消息可复制')
    return
  }
  const text = msgs.map((m) => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`).join('\n\n')
  try {
    await navigator.clipboard.writeText(text)
    toast.success('已复制到剪贴板')
  } catch {
    toast.error('复制失败')
  }
}

async function doExport(id: string) {
  const session = chat.sessions.find((s) => s.id === id)
  if (!session) return
  try {
    await chat.loadMessages(id)
  } catch {}
  const msgs = chat.messages.length ? chat.messages : session.messages
  const lines = [
    `# ${session.title || '新对话'}`,
    `模型：${session.modelId || '默认'}`,
    `时间：${new Date(session.updatedAt).toLocaleString('zh-CN')}`,
    '',
    '---',
    '',
    ...msgs.map((m) => `**${m.role === 'user' ? '用户' : 'AI'}**：\n\n${m.content}\n`),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${session.title || '对话'}.md`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('已导出')
}

async function doDelete(id: string, title?: string) {
  const ok = await confirm('删除对话', `确定删除对话"${title || '新对话'}"吗？此操作不可恢复。`, 'danger')
  if (!ok) return
  try {
    await chat.deleteSession(id)
    toast.success('对话已删除')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '删除失败')
  }
}

function formatTime(timestamp: number) {
  if (!timestamp) return '刚刚'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}
</script>

<style scoped>
.chat-list-page {
  max-width: 920px;
}

.chat-start {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 320px) auto;
  gap: 16px;
  align-items: center;
  padding: 24px;
  margin-bottom: 28px;
}

.start-copy {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 16px;
}

.start-icon,
.session-icon {
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 18px;
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: var(--shadow-soft);
}

.start-copy h2,
.section-heading h2 {
  color: var(--text-strong);
  font-size: 1.35rem;
  font-weight: 900;
}

.start-copy p {
  margin-top: 5px;
}

.new-chat-btn {
  min-height: 56px;
  white-space: nowrap;
}

.history-section {
  display: grid;
  gap: 16px;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.refresh-btn {
  min-height: 42px;
}

.session-list {
  display: grid;
  gap: 14px;
}

.session-card {
  min-width: 0;
  min-height: 88px;
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  border: 1px solid var(--border);
  padding: 18px;
  color: var(--text-strong);
  text-align: left;
  cursor: pointer;
  -webkit-touch-callout: none;
  user-select: none;
}

.session-card:hover {
  transform: translateY(-1px);
  border-color: rgba(109, 53, 246, 0.34);
  box-shadow: var(--shadow);
}

.session-card:active {
  transform: scale(0.99);
}

.session-card.pinned {
  border-color: rgba(109, 53, 246, 0.25);
  background: linear-gradient(135deg, rgba(109, 53, 246, 0.04), rgba(109, 53, 246, 0.02));
}

.pin-icon {
  color: var(--accent);
  vertical-align: -2px;
  margin-right: 4px;
}

.inline-edit {
  width: 100%;
  border: 1px solid var(--accent);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 1.12rem;
  font-weight: 900;
  color: var(--text-strong);
  background: var(--panel-strong);
  outline: none;
}

.prompt-modal {
  display: grid;
  gap: 16px;
}

.prompt-modal textarea {
  width: 100%;
  min-height: 140px;
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 14px;
  color: var(--text-strong);
  background: var(--panel-strong);
  font-size: 0.95rem;
  resize: vertical;
  outline: none;
}

.prompt-modal textarea:focus {
  border-color: var(--accent);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  font-weight: 900;
  color: var(--text-strong);
}

.close-only {
  width: 44px;
  height: 44px;
  padding: 0;
  display: grid;
  place-items: center;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.session-main {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.session-main strong,
.session-main small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-main strong {
  font-size: 1.12rem;
  font-weight: 900;
}

.session-main small {
  color: var(--text);
}

.load-more-btn {
  width: 100%;
  min-height: 48px;
  border: 1px dashed var(--border);
  border-radius: 14px;
  background: transparent;
  color: var(--text);
  font-weight: 800;
  font-size: 0.9rem;
  transition: border-color 0.15s, color 0.15s;
}

.load-more-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

@media (max-width: 760px) {
  .chat-start {
    grid-template-columns: 1fr;
    padding: 20px;
  }

  .new-chat-btn,
  :deep(.model-picker) {
    width: 100%;
  }
}
</style>
