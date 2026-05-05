<template>
  <section class="session-shell">
    <aside class="session-rail">
      <div class="rail-header">
        <button class="secondary-btn back-btn" @click="goBack"><ArrowLeft :size="22" />返回</button>
        <button class="primary-btn rail-new" @click="startNew"><Plus :size="22" />新对话</button>
      </div>
      <ModelPicker v-model="chat.selectedModelId" :models="chat.models" />
      <div class="rail-list">
        <button
          v-for="session in chat.sortedSessions"
          :key="session.id"
          class="rail-session"
          :class="{ active: session.id === chat.currentSessionId, pinned: session.pinned }"
          @click="openSession(session.id)"
          @contextmenu.prevent="openCtx($event, session)"
          @touchstart.passive="ctx.onTouchStart($event, getActions(session))"
          @touchmove.passive="ctx.onTouchMove"
          @touchend.passive="ctx.onTouchEnd"
          @mousedown="ctx.onMouseDown($event, getActions(session))"
          @mousemove="ctx.onMouseMove"
          @mouseup="ctx.onMouseUp"
        >
          <template v-if="editingId === session.id">
            <input
              v-model="editTitle"
              class="rail-inline-edit"
              @click.stop
              @keydown.enter="saveRename(session.id)"
              @keydown.escape="editingId = null"
              @blur="saveRename(session.id)"
            />
          </template>
          <template v-else>
            <strong><Pin v-if="session.pinned" :size="12" class="pin-icon" />{{ session.title || '新对话' }}</strong>
          </template>
          <small>{{ session.modelId || '默认模型' }}</small>
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
    </aside>

    <main class="chat-main">
      <header class="chat-header">
        <button class="ghost-btn mobile-back" @click="goBack"><ArrowLeft :size="28" /></button>
        <div class="title-block">
          <h1>{{ pageTitle }}</h1>
          <p>{{ chat.isDraft ? '发送第一条消息后保存到历史列表' : currentModelLabel }}</p>
        </div>
        <button type="button" class="model-chip" @click="sheetVisible = true">
          <Cpu :size="16" />
          <span>{{ currentModelShort }}</span>
          <ChevronDown :size="16" />
        </button>
      </header>

      <ModelSheet v-model:visible="sheetVisible" v-model:model-value="chat.selectedModelId" :options="modelOptions" />

      <div ref="scrollRef" class="chat-scroll">
        <div v-if="sessionLoading" class="empty-state glass-card">正在加载对话...</div>
        <div v-else-if="chat.messages.length === 0" class="welcome">
          <div class="robot-orb"><Bot :size="104" /></div>
          <h2>开始对话</h2>
          <p>输入问题，或者选择一个快捷提示</p>
          <div class="prompt-cards">
            <button v-for="prompt in prompts" :key="prompt.title" class="prompt-card glass-card" @click="sendQuick(prompt.message)">
              <span class="prompt-icon"><component :is="prompt.icon" :size="30" /></span>
              <span>
                <strong>{{ prompt.title }}</strong>
                <small>{{ prompt.desc }}</small>
              </span>
              <ChevronRight :size="24" />
            </button>
          </div>
        </div>

        <div v-else class="messages">
          <article v-for="message in chat.messages" :key="message.id" class="message-row" :class="message.role">
            <div class="avatar">
              <User v-if="message.role === 'user'" :size="20" />
              <Bot v-else :size="20" />
            </div>
            <div class="bubble glass-card">
              <div v-if="message.loading" class="typing"><span /><span /><span /></div>
              <div v-else class="message-content" v-html="renderMessage(message.content)" />
              <small v-if="message.error" class="message-error">{{ message.error }}</small>
            </div>
          </article>
        </div>
      </div>

      <form class="composer" @submit.prevent="send">
        <input v-model="draft" :disabled="chat.sending" placeholder="输入消息...（Enter 发送）" />
        <button class="primary-btn send-button" :disabled="chat.sending || !draft.trim()">
          <Send :size="22" />
          <span>发送</span>
        </button>
      </form>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Cpu,
  Download,
  Eraser,
  FileText,
  GitBranch,
  Library,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  Trash2,
  User,
  WandSparkles,
  X,
} from 'lucide-vue-next'
import ModelPicker from '@/components/ModelPicker.vue'
import ModelSheet from '@/components/ModelSheet.vue'
import { useChatStore } from '@/stores/chat'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useContextMenu } from '@/composables/useContextMenu'
import { useNativeBackClose } from '@/composables/useNativeBackClose'

const route = useRoute()
const router = useRouter()
const chat = useChatStore()
const { confirm } = useConfirm()
const toast = useToast()
const ctx = useContextMenu()
const draft = ref('')
const scrollRef = ref<HTMLElement | null>(null)
const sheetVisible = ref(false)
const sessionLoading = ref(false)
const editingId = ref<string | null>(null)
const editTitle = ref('')
const promptOpen = ref(false)
const promptSessionId = ref<string | null>(null)
const promptText = ref('')

const modelOptions = computed(() =>
  chat.models.map((model) => ({
    value: model.id,
    label: model.name,
    subtitle: model.provider,
  })),
)

const currentModelShort = computed(() => {
  const model = chat.models.find((item) => item.id === chat.selectedModelId)
  return model?.name ?? '选择模型'
})

const prompts = [
  { title: '帮我写代码', desc: '生成、优化或解释代码', message: '帮我写代码', icon: Code2 },
  { title: '知识问答', desc: '解答各类知识问题', message: '知识问答', icon: Library },
  { title: '日志分析', desc: '分析日志，定位问题', message: '日志分析', icon: Search },
]

const pageTitle = computed(() => chat.currentSession?.title || '新对话')
const currentModelLabel = computed(() => {
  const model = chat.models.find((item) => item.id === chat.selectedModelId)
  return model ? `${model.name} · ${model.provider}` : '默认模型'
})

useNativeBackClose(sheetVisible, () => {
  sheetVisible.value = false
})

useNativeBackClose(promptOpen, () => {
  promptOpen.value = false
})

onMounted(prepareRoute)

watch(
  () => route.fullPath,
  () => prepareRoute(),
)

watch(
  () => chat.messages.length,
  () => nextTick(scrollToBottom),
)

async function prepareRoute() {
  // Cancel any in-flight send before switching sessions
  chat.cancelSend()

  const isDraft = route.name === 'chat-new'

  if (!isDraft) {
    sessionLoading.value = true
    chat.messages = []
  }

  await chat.fetchModels()
  await chat.loadConversations()

  if (isDraft) {
    chat.startDraftSession()
  } else {
    await chat.selectSession(String(route.params.id))
    sessionLoading.value = false
  }

  await nextTick(scrollToBottom)
}

function renderMessage(content: string) {
  return marked.parse(content || '', { async: false })
}

function scrollToBottom() {
  if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight
}

function goBack() {
  router.push('/chat')
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
    const input = document.querySelector('.rail-inline-edit') as HTMLInputElement
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
  const msgs = chat.currentSessionId === id ? chat.messages : session.messages
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
  const msgs = chat.currentSessionId === id ? chat.messages : session.messages
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
    if (chat.currentSessionId === id) router.push('/chat')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : '删除失败')
  }
}

async function send() {
  const content = draft.value
  draft.value = ''
  const result = await chat.sendMessage(content)
  if (route.name === 'chat-new' && result.session?.id) {
    router.replace(`/chat/${result.session.id}`)
  }
}

function sendQuick(message: string) {
  draft.value = message
  send()
}
</script>

<style scoped>
.session-shell {
  height: var(--app-viewport-height);
  display: grid;
  overflow: hidden;
}

.session-rail {
  display: none;
}

.chat-main {
  min-width: 0;
  height: var(--app-viewport-height);
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
}

.chat-header {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
}

.mobile-back {
  width: 52px;
  min-height: 52px;
  padding: 0;
  color: var(--text-strong);
}

.title-block {
  min-width: 0;
}

.title-block h1,
.title-block p {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title-block h1 {
  color: var(--text-strong);
  font-size: 1.15rem;
  font-weight: 900;
}

.title-block p {
  margin-top: 2px;
  color: var(--text);
  font-size: 0.82rem;
}

.model-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--accent);
  background: var(--accent-soft);
  font-size: 0.78rem;
  font-weight: 800;
  white-space: nowrap;
  flex-shrink: 0;
}

.model-chip svg:first-child {
  color: var(--accent);
}

.model-chip span {
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-scroll {
  min-height: 0;
  overflow: auto;
  padding: 12px 16px 22px;
}

.welcome {
  width: min(100%, 820px);
  margin: 0 auto;
  display: grid;
  gap: 18px;
  justify-items: center;
  text-align: center;
}

.robot-orb {
  width: min(50vw, 260px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  color: var(--accent);
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.95), rgba(229, 220, 255, 0.4) 62%, transparent 63%),
    radial-gradient(circle at 50% 78%, rgba(109, 53, 246, 0.18), transparent 36%);
}

.welcome h2 {
  color: var(--text-strong);
  font-size: clamp(1.8rem, 6vw, 3rem);
  font-weight: 900;
}

.prompt-cards {
  width: min(100%, 760px);
  display: grid;
  gap: 14px;
}

.prompt-card {
  min-height: 92px;
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  border: 1px solid var(--border);
  padding: 14px 16px;
  color: var(--text-strong);
  text-align: left;
}

.prompt-icon {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  color: var(--accent);
  background: var(--accent-soft);
}

.prompt-card strong,
.prompt-card small {
  display: block;
}

.prompt-card strong {
  font-size: 1.15rem;
  font-weight: 900;
}

.prompt-card small {
  color: var(--text);
}

.messages {
  width: min(100%, 920px);
  margin: 0 auto;
  display: grid;
  gap: 16px;
}

.message-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.message-row.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 15px;
  color: var(--accent);
  background: var(--accent-soft);
}

.bubble {
  max-width: min(76vw, 720px);
  min-width: 0;
  padding: 16px 18px;
  color: var(--text-strong);
  text-align: left;
}

.user .bubble {
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
}

.message-content :deep(p) {
  margin: 0 0 10px;
}

.message-content :deep(p:last-child) {
  margin-bottom: 0;
}

.message-content :deep(pre) {
  overflow: auto;
  padding: 14px;
  border-radius: 14px;
  background: rgba(15, 23, 42, 0.08);
}

.message-error {
  display: block;
  margin-top: 8px;
  color: #fecaca;
}

.typing {
  display: flex;
  gap: 6px;
  padding: 8px 0;
}

.typing span {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--accent);
  animation: pulse 1.2s infinite ease-in-out;
}

.typing span:nth-child(2) {
  animation-delay: 0.15s;
}

.typing span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes pulse {
  0%, 100% { opacity: 0.35; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-4px); }
}

.composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px;
  gap: 10px;
  padding: 12px;
  border-top: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.74);
  backdrop-filter: blur(18px);
}

.composer input {
  min-width: 0;
  min-height: 56px;
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 0 16px;
  color: var(--text-strong);
  background: var(--panel-strong);
  outline: none;
}

.send-button {
  min-width: 72px;
  min-height: 56px;
  border-radius: 18px;
  padding: 0;
}

.send-button span {
  display: none;
}

@media (min-width: 760px) {
  .session-shell {
    grid-template-columns: minmax(300px, 340px) minmax(0, 1fr);
  }

  .session-rail {
    min-width: 0;
    height: var(--app-viewport-height);
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 16px;
    padding: 22px;
    border-right: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(26px);
  }

  :root[data-theme='dark'] .session-rail {
    background: rgba(17, 19, 32, 0.82);
  }

  .rail-header {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .rail-new,
  .back-btn {
    min-height: 50px;
    padding: 0 14px;
  }

  .rail-list {
    min-height: 0;
    overflow: auto;
    display: grid;
    align-content: start;
    gap: 10px;
  }

  .rail-session {
    min-width: 0;
    min-height: 68px;
    display: grid;
    gap: 4px;
    border: 0;
    border-radius: 18px;
    padding: 12px 14px;
    color: var(--text);
    background: transparent;
    text-align: left;
    cursor: pointer;
    -webkit-touch-callout: none;
    user-select: none;
  }

  .rail-session strong,
  .rail-session small {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rail-session strong {
    color: var(--text-strong);
    font-weight: 900;
  }

  .rail-session.active,
  .rail-session:hover {
    color: var(--accent);
    background: var(--accent-soft);
  }

  .rail-session.active strong {
    color: var(--accent);
  }

  .rail-session.pinned {
    background: rgba(109, 53, 246, 0.05);
    border-left: 3px solid var(--accent);
  }

  .rail-session.pinned.active {
    background: var(--accent-soft);
  }

  .chat-header {
    grid-template-columns: auto minmax(0, 1fr);
    padding: 22px 28px 12px;
  }

  .mobile-back {
    display: none;
  }

  .model-chip {
    display: none;
  }

  .chat-scroll {
    padding: 18px 28px;
  }

  .composer {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    padding: 16px 28px 22px;
  }

  .composer input {
    min-height: 64px;
    border-radius: 22px;
    padding: 0 22px;
    font-size: 1.05rem;
  }

  .send-button {
    min-width: 122px;
    min-height: 64px;
    border-radius: 22px;
    padding: 0 22px;
  }

  .send-button span {
    display: inline;
  }
}

.pin-icon {
  color: var(--accent);
  vertical-align: -1px;
  margin-right: 4px;
}

.rail-inline-edit {
  width: 100%;
  border: 1px solid var(--accent);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 0.95rem;
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

.prompt-modal .modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.prompt-modal .modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  font-weight: 900;
  color: var(--text-strong);
}

.prompt-modal .close-only {
  width: 44px;
  height: 44px;
  padding: 0;
  display: grid;
  place-items: center;
}

.prompt-modal .modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 560px) {
  .bubble {
    max-width: calc(100vw - 94px);
  }

  .prompt-card {
    grid-template-columns: 52px minmax(0, 1fr) auto;
  }
}
</style>
