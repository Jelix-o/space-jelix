<script setup lang="ts">
/**
 * ChatMessage – renders a single chat bubble with Markdown support
 */
import { computed } from 'vue'
import { marked } from 'marked'
import type { ChatMessage } from '@/types'

const props = defineProps<{ message: ChatMessage }>()

const isUser = computed(() => props.message.role === 'user')

const renderedContent = computed(() => {
  if (!props.message.content) return ''
  try {
    return marked.parse(props.message.content, { async: false })
  } catch {
    return props.message.content
  }
})

const timeStr = computed(() => {
  const d = new Date(props.message.timestamp)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
})
</script>

<template>
  <div class="chat-message" :class="{ user: isUser, assistant: !isUser }">
    <div class="avatar">
      <span v-if="isUser">👤</span>
      <span v-else>🤖</span>
    </div>

    <div class="bubble">
      <div class="meta">
        <span class="role">{{ isUser ? '你' : 'Hermes AI' }}</span>
        <span class="time">{{ timeStr }}</span>
      </div>

      <div v-if="message.loading" class="loading-indicator">
        <span class="dot" /><span class="dot" /><span class="dot" />
      </div>

      <div
        v-else
        class="content markdown-body"
        v-html="renderedContent"
      />

      <div v-if="message.error" class="error">{{ message.error }}</div>
    </div>
  </div>
</template>

<style scoped>
.chat-message {
  display: flex;
  gap: 12px;
  max-width: 85%;
}

.chat-message.user {
  flex-direction: row-reverse;
  align-self: flex-end;
}

.chat-message.assistant {
  align-self: flex-start;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--code-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.user .avatar {
  background: var(--accent-bg);
}

.bubble {
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  min-width: 120px;
}

.user .bubble {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.user .bubble .meta {
  color: rgba(255, 255, 255, 0.7);
}

.meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--text);
  margin-bottom: 6px;
}

.role {
  font-weight: 600;
}

.content {
  font-size: 15px;
  line-height: 1.6;
  word-break: break-word;
}

.content :deep(p) {
  margin: 0 0 8px;
}

.content :deep(p:last-child) {
  margin: 0;
}

.content :deep(code) {
  font-family: var(--mono);
  font-size: 13px;
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 5px;
  border-radius: 4px;
}

.user .content :deep(code) {
  background: rgba(255, 255, 255, 0.2);
}

.content :deep(pre) {
  background: var(--code-bg);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 8px 0;
}

.content :deep(pre code) {
  background: transparent;
  padding: 0;
}

.content :deep(blockquote) {
  border-left: 3px solid var(--accent-border);
  margin: 8px 0;
  padding: 4px 12px;
  color: var(--text);
}

.content :deep(ul),
.content :deep(ol) {
  padding-left: 20px;
  margin: 4px 0;
}

.content :deep(h1),
.content :deep(h2),
.content :deep(h3) {
  margin: 12px 0 6px;
  color: var(--text-h);
  font-size: 1em;
}

.user .content :deep(h1),
.user .content :deep(h2),
.user .content :deep(h3) {
  color: #fff;
}

/* Loading dots animation */
.loading-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text);
  animation: bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.error {
  margin-top: 6px;
  font-size: 13px;
  color: #ef4444;
}
</style>
