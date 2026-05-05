<template>
  <section class="terminal-shell">
    <header class="terminal-bar">
      <button class="ghost-btn" @click="goBack"><ArrowLeft :size="22" /></button>
      <div class="term-info">
        <strong>{{ connName }}</strong>
        <small :class="['status', status]">{{ statusLabel }}</small>
      </div>
      <div class="term-actions">
        <button v-if="status === 'disconnected'" class="primary-btn" @click="connect">
          <Play :size="18" />连接
        </button>
        <button v-else-if="status === 'connected'" class="danger-btn" @click="disconnect">
          <Square :size="18" />断开
        </button>
        <button v-else class="secondary-btn" disabled>连接中...</button>
      </div>
    </header>
    <div ref="termContainer" class="term-container" />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { ArrowLeft, Play, Square } from 'lucide-vue-next'
import { useConnectionsStore } from '@/stores/connections'
import { getBaseUrl } from '@/api'

const route = useRoute()
const router = useRouter()
const store = useConnectionsStore()

const termContainer = ref<HTMLElement | null>(null)
const status = ref<'connecting' | 'connected' | 'disconnected'>('disconnected')
const connName = ref('')

let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let ws: WebSocket | null = null
let resizeObserver: ResizeObserver | null = null

const statusLabel = computed(() => {
  if (status.value === 'connecting') return '连接中...'
  if (status.value === 'connected') return '已连接'
  return '未连接'
})

onMounted(async () => {
  const id = Number(route.params.id)
  // Fetch connections if not loaded
  if (store.connections.length === 0) {
    await store.fetchConnections()
  }
  const conn = store.connections.find((c) => c.id === id)
  connName.value = conn?.name || `终端 #${id}`

  terminal = new Terminal({
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
    theme: {
      background: '#1a1b26',
      foreground: '#c0caf5',
      cursor: '#c0caf5',
      selectionBackground: '#33467c',
    },
    cursorBlink: true,
    convertEol: true,
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(new WebLinksAddon())

  if (termContainer.value) {
    terminal.open(termContainer.value)
    await nextTick()
    fitAddon.fit()
  }

  terminal.onData((data) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data }))
    }
  })

  terminal.onResize(({ cols, rows }) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }))
    }
  })

  resizeObserver = new ResizeObserver(() => {
    fitAddon?.fit()
  })
  if (termContainer.value) {
    resizeObserver.observe(termContainer.value)
  }

  connect()
})

onBeforeUnmount(() => {
  disconnect()
  resizeObserver?.disconnect()
  terminal?.dispose()
})

function getWsUrl() {
  const base = getBaseUrl()
  try {
    const u = new URL(base)
    const protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${u.host}/terminal`
  } catch {
    const loc = window.location
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${loc.host}/terminal`
  }
}

function connect() {
  if (ws) return
  status.value = 'connecting'

  ws = new WebSocket(getWsUrl())

  ws.onopen = () => {
    ws!.send(
      JSON.stringify({
        type: 'connect',
        connectionId: Number(route.params.id),
        cols: terminal?.cols || 80,
        rows: terminal?.rows || 24,
      }),
    )
  }

  ws.onmessage = (e) => {
    let msg: any
    try {
      msg = JSON.parse(e.data)
    } catch {
      return
    }

    if (msg.type === 'connected') {
      status.value = 'connected'
      terminal?.focus()
    } else if (msg.type === 'output') {
      terminal?.write(msg.data)
    } else if (msg.type === 'error') {
      terminal?.writeln(`\r\n\x1b[31m${msg.data}\x1b[0m`)
      status.value = 'disconnected'
      ws?.close()
      ws = null
    } else if (msg.type === 'closed') {
      terminal?.writeln('\r\n\x1b[33m[Connection closed]\x1b[0m')
      status.value = 'disconnected'
      ws = null
    }
  }

  ws.onerror = () => {
    terminal?.writeln('\r\n\x1b[31m[WebSocket error]\x1b[0m')
    status.value = 'disconnected'
    ws = null
  }

  ws.onclose = () => {
    if (status.value === 'connected') {
      terminal?.writeln('\r\n\x1b[33m[Connection closed]\x1b[0m')
    }
    status.value = 'disconnected'
    ws = null
  }
}

function disconnect() {
  if (ws) {
    ws.close()
    ws = null
  }
  status.value = 'disconnected'
}

function goBack() {
  disconnect()
  router.push('/connections')
}
</script>

<style scoped>
.terminal-shell {
  height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
  background: #1a1b26;
}

.terminal-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(26, 27, 38, 0.95);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.terminal-bar .ghost-btn {
  color: #c0caf5;
}

.term-info {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
}

.term-info strong {
  color: #c0caf5;
  font-size: 0.95rem;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.term-info small {
  font-size: 0.75rem;
  font-weight: 600;
}

.term-info small.connecting {
  color: #e0af68;
}

.term-info small.connected {
  color: #9ece6a;
}

.term-info small.disconnected {
  color: #565f89;
}

.term-actions {
  display: flex;
  gap: 8px;
}

.term-actions .primary-btn,
.term-actions .danger-btn,
.term-actions .secondary-btn {
  min-height: 36px;
  padding: 0 14px;
  font-size: 0.82rem;
}

.term-container {
  min-height: 0;
  overflow: hidden;
}

.term-container :deep(.xterm) {
  padding: 8px;
}

.term-container :deep(.xterm-viewport) {
  overflow-y: auto !important;
}
</style>
