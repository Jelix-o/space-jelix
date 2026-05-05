import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Capacitor } from '@capacitor/core'
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

if (Capacitor.isNativePlatform()) {
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setBackgroundColor({ color: '#6d35f6' })
    StatusBar.setStyle({ style: Style.Dark })
  })
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
