<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="handleLogin">
      <div class="login-brand">
        <span class="brand-mark">J</span>
        <h1>Space Jelix</h1>
      </div>
      <p class="login-subtitle">输入密码以继续访问</p>
      <div class="field">
        <input
          v-model="password"
          type="password"
          placeholder="密码"
          autocomplete="current-password"
          autofocus
        />
      </div>
      <p v-if="error" class="login-error">{{ error }}</p>
      <button type="submit" class="login-btn" :disabled="loading || !password">
        {{ loading ? '验证中...' : '登录' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authApi, AUTH_TOKEN_KEY } from '@/api'

const router = useRouter()
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!password.value) return
  loading.value = true
  error.value = ''
  try {
    const { token } = await authApi.login(password.value)
    localStorage.setItem(AUTH_TOKEN_KEY, token)
    router.replace('/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: var(--app-viewport-height);
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--app-background);
}

.login-card {
  width: 100%;
  max-width: 360px;
  padding: 40px 28px 32px;
  border-radius: var(--radius-lg);
  background: var(--panel-strong);
  backdrop-filter: blur(24px);
  box-shadow: var(--shadow);
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 8px;
}

.login-brand .brand-mark {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  color: #fff;
  font-size: 1.4rem;
  font-weight: 900;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 12px 28px rgba(109, 53, 246, 0.3);
}

.login-brand h1 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 900;
  color: var(--text-strong);
}

.login-subtitle {
  margin: 0 0 28px;
  font-size: 0.88rem;
  color: var(--muted);
}

.field {
  margin-bottom: 16px;
}

.field input {
  width: 100%;
  height: 52px;
  padding: 0 18px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
  color: var(--text-strong);
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
}

.field input:focus {
  border-color: var(--accent);
}

.login-error {
  margin: -8px 0 12px;
  font-size: 0.84rem;
  color: var(--danger);
}

.login-btn {
  width: 100%;
  height: 50px;
  border: none;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}

.login-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
