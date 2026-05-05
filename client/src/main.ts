import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'

try {
  const saved = localStorage.getItem('hermes-hub-settings')
  const settings = saved ? JSON.parse(saved) : null
  const theme = settings?.theme === 'dark'
    ? 'dark'
    : settings?.theme === 'light'
      ? 'light'
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  if (settings?.fontSize) {
    document.documentElement.style.setProperty('--font-size', `${settings.fontSize}px`)
  }
} catch {
  // Keep CSS defaults when settings are malformed.
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
