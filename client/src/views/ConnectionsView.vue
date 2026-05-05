<template>
  <section class="page terminal-page">
    <header class="page-hero">
      <div class="hero-icon"><TerminalSquare :size="44" /></div>
      <div>
        <h1 class="page-title">终端连接</h1>
        <p class="page-subtitle">配置多个服务器终端，后续可直接进入 SSH 工作台</p>
      </div>
    </header>

    <div class="toolbar terminal-toolbar">
      <button class="primary-btn" @click="openCreate"><Plus :size="24" />添加终端</button>
    </div>

    <div v-if="store.error" class="error-state glass-card">{{ store.error }}</div>
    <div v-else-if="store.loading" class="empty-state glass-card">正在加载终端连接...</div>
    <div v-else-if="store.connections.length === 0" class="empty-state glass-card">还没有终端连接</div>

    <div v-else class="terminal-grid">
      <article v-for="conn in store.connections" :key="conn.id" class="terminal-card glass-card">
        <span class="terminal-icon"><Server :size="34" /></span>
        <span class="status-dot" :class="statusClass(conn)" />
        <div class="terminal-main">
          <h2>{{ conn.name }}</h2>
          <p>{{ conn.username }}@{{ conn.host }}:{{ conn.port }}</p>
        </div>
        <span class="badge">{{ conn.auth_type === 'key' ? '密钥' : '密码' }}</span>
        <div class="terminal-meta">
          <span :class="['status-text', statusClass(conn)]">● {{ statusLabel(conn) }}</span>
          <span v-if="conn.default_path">默认目录：{{ conn.default_path }}</span>
          <span v-if="conn.last_error" class="error-text">{{ conn.last_error }}</span>
        </div>
        <div class="terminal-actions">
          <button class="secondary-btn" :disabled="store.testingIds.has(conn.id)" @click="test(conn.id)">
            <Search :size="21" />{{ store.testingIds.has(conn.id) ? '测试中' : '测试' }}
          </button>
          <button class="secondary-btn" @click="openEdit(conn)"><Pencil :size="21" />编辑</button>
          <button class="secondary-btn" @click="openTerminal(conn.id)"><Terminal :size="21" />打开</button>
          <button class="danger-btn" @click="remove(conn)"><Trash2 :size="21" />删除</button>
        </div>
      </article>
    </div>

    <Teleport to="body">
      <div v-if="modalOpen" class="modal-backdrop" @click.self="closeModal">
        <form class="modal-panel terminal-modal" @submit.prevent="submit">
          <div class="modal-header">
            <div class="modal-title">
              <span class="modal-badge"><TerminalSquare :size="28" /></span>
              <span>{{ editingId ? '编辑终端' : '添加终端' }}</span>
            </div>
            <button type="button" class="ghost-btn close-only" @click="closeModal"><X :size="28" /></button>
          </div>

          <div class="modal-body">
            <div class="form-grid">
              <div class="field">
                <label>连接名称 *</label>
                <input v-model.trim="form.name" required placeholder="例如：生产服务器" />
              </div>
              <div class="field">
                <label>用户名 *</label>
                <input v-model.trim="form.username" required placeholder="root" autocomplete="username" />
              </div>
            </div>

            <div class="form-grid host-grid">
              <div class="field">
                <label>主机 *</label>
                <input v-model.trim="form.host" required placeholder="192.168.1.10 或 example.com" />
              </div>
              <div class="field">
                <label>端口</label>
                <input v-model.number="form.port" required type="number" min="1" max="65535" placeholder="22" />
              </div>
            </div>

            <div class="field">
              <label>认证方式</label>
              <AppSelect v-model="form.auth_type" :options="authTypeOptions" />
            </div>

            <div v-if="form.auth_type === 'password'" class="field">
              <label>密码</label>
              <input v-model="form.password" type="password" placeholder="留空则不修改已保存密码" autocomplete="current-password" />
            </div>
            <div v-else class="field">
              <label>密钥文件</label>
              <div class="key-upload">
                <label class="upload-btn secondary-btn" tabindex="0">
                  <Upload :size="18" />
                  <span>{{ keyFileName || '选择密钥文件' }}</span>
                  <input type="file" accept=".pem,.key,.pub,*" @change="onKeyFileChange" hidden />
                </label>
                <span v-if="editingId && form.key_path && !keyFile" class="key-hint">已上传密钥文件</span>
              </div>
            </div>

            <div class="field">
              <label>默认目录</label>
              <input v-model.trim="form.default_path" placeholder="/home/root/project" />
            </div>

            <p class="hint">保存连接配置后，点击"打开"即可进入网页终端。</p>
            <p v-if="formError" class="modal-error">{{ formError }}</p>
          </div>

          <div class="modal-actions">
            <button type="button" class="secondary-btn" @click="closeModal">取消</button>
            <button class="primary-btn" :disabled="submitting">{{ submitting ? '保存中...' : '保存终端' }}</button>
          </div>
        </form>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Pencil, Plus, Search, Server, Terminal, TerminalSquare, Trash2, Upload, X } from 'lucide-vue-next'
import AppSelect from '@/components/AppSelect.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useModalLock } from '@/composables/useModalLock'
import { useToast } from '@/composables/useToast'
import { useConnectionsStore } from '@/stores/connections'
import type { TerminalAuthType, TerminalConnectionInfo } from '@/types'

const router = useRouter()
const store = useConnectionsStore()
const { confirm } = useConfirm()
const toast = useToast()
const modalOpen = ref(false)
const submitting = ref(false)
const formError = ref('')
const editingId = ref<number | null>(null)
const authTypeOptions = [
  { value: 'password', label: '密码', subtitle: '使用账号密码连接' },
  { value: 'key', label: '密钥文件', subtitle: '使用本地私钥路径连接' },
]
const keyFile = ref<File | null>(null)
const keyFileName = ref('')
const form = reactive({
  name: '',
  host: '',
  port: 22,
  username: '',
  auth_type: 'password' as TerminalAuthType,
  password: '',
  key_path: '',
  default_path: '',
})

onMounted(() => {
  store.fetchConnections()
})

useModalLock(modalOpen)

function openCreate() {
  editingId.value = null
  keyFile.value = null
  keyFileName.value = ''
  Object.assign(form, {
    name: '',
    host: '',
    port: 22,
    username: '',
    auth_type: 'password',
    password: '',
    key_path: '',
    default_path: '',
  })
  formError.value = ''
  modalOpen.value = true
}

function openEdit(conn: TerminalConnectionInfo) {
  editingId.value = conn.id
  keyFile.value = null
  keyFileName.value = ''
  Object.assign(form, {
    name: conn.name,
    host: conn.host,
    port: conn.port || 22,
    username: conn.username,
    auth_type: conn.auth_type,
    password: '',
    key_path: conn.key_path || '',
    default_path: conn.default_path || '',
  })
  formError.value = ''
  modalOpen.value = true
}

function onKeyFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    keyFile.value = file
    keyFileName.value = file.name
  }
}

function openTerminal(id: number) {
  router.push(`/terminal/${id}`)
}

function closeModal() {
  modalOpen.value = false
}

async function submit() {
  submitting.value = true
  formError.value = ''
  try {
    const payload = {
      name: form.name,
      host: form.host,
      port: Number(form.port || 22),
      username: form.username,
      auth_type: form.auth_type,
      key_path: form.auth_type === 'key' ? form.key_path : '',
      default_path: form.default_path,
      ...(form.password ? { password: form.password } : {}),
    }
    let connId = editingId.value
    if (connId) {
      await store.updateConnection(connId, payload)
    } else {
      const created = await store.createConnection(payload)
      connId = created.id
    }
    // Upload key file if provided
    if (keyFile.value && connId) {
      await store.uploadKey(connId, keyFile.value)
      toast.success('密钥文件已上传')
    }
    closeModal()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  } finally {
    submitting.value = false
  }
}

async function test(id: number) {
  await store.testConnection(id).catch(() => undefined)
}

async function remove(conn: TerminalConnectionInfo) {
  const ok = await confirm('删除终端', `确定删除终端”${conn.name}”吗？此操作不可恢复。`, 'danger')
  if (!ok) return
  await store.deleteConnection(conn.id)
}

function statusClass(conn: TerminalConnectionInfo) {
  if (store.testingIds.has(conn.id)) return 'testing'
  if (conn.status === 'reachable') return 'connected'
  if (conn.status === 'error') return 'error'
  return 'disconnected'
}

function statusLabel(conn: TerminalConnectionInfo) {
  if (store.testingIds.has(conn.id)) return '测试中'
  if (conn.status === 'reachable') return '端口可达'
  if (conn.status === 'error') return '连接异常'
  return '未测试'
}
</script>

<style scoped>
.terminal-page {
  max-width: 1120px;
}

.terminal-toolbar {
  justify-content: flex-end;
}

.terminal-grid {
  display: grid;
  gap: 20px;
}

.terminal-card {
  position: relative;
  min-width: 0;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 26px;
}

.terminal-icon,
.modal-badge {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  border-radius: 20px;
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: var(--shadow-soft);
}

.terminal-card > .status-dot {
  position: absolute;
  top: 24px;
  right: 24px;
}

.terminal-main {
  min-width: 0;
  display: grid;
  gap: 6px;
  padding-right: 18px;
}

.terminal-main h2 {
  min-width: 0;
  overflow: hidden;
  color: var(--text-strong);
  font-size: clamp(1.35rem, 3.5vw, 2rem);
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terminal-main p,
.terminal-meta span {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-family: var(--mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.terminal-meta {
  grid-column: 2 / -1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
}

.status-text.connected {
  color: var(--success);
}

.status-text.error,
.error-text {
  color: var(--danger);
}

.status-text.testing {
  color: var(--warning);
}

.terminal-actions {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.terminal-modal {
  display: grid;
  gap: 18px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.host-grid {
  grid-template-columns: minmax(0, 1fr) 130px;
}

.close-only {
  width: 54px;
  min-height: 54px;
  padding: 0;
}

.hint {
  color: var(--muted);
  line-height: 1.6;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.key-upload {
  display: flex;
  align-items: center;
  gap: 12px;
}

.upload-btn {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.key-hint {
  color: var(--text);
  font-size: 0.85rem;
}

.modal-error {
  color: var(--danger);
  font-weight: 800;
}

@media (min-width: 1040px) {
  .terminal-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .terminal-toolbar {
    justify-content: stretch;
  }

  .terminal-toolbar .primary-btn {
    width: 100%;
  }

  .terminal-card {
    grid-template-columns: 54px minmax(0, 1fr);
    padding: 22px;
  }

  .terminal-icon,
  .modal-badge {
    width: 52px;
    height: 52px;
    border-radius: 18px;
  }

  .terminal-card .badge {
    grid-column: 2;
    width: fit-content;
  }

  .terminal-meta {
    grid-column: 1 / -1;
  }

  .terminal-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .form-grid,
  .host-grid {
    grid-template-columns: 1fr;
  }
}
</style>
