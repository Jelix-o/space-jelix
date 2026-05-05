import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
import { applyDocumentAppearance, readStoredAppearanceSettings, subscribeSystemThemeChange } from './utils/nativeAppearance'

const initialAppearance = readStoredAppearanceSettings()
applyDocumentAppearance(initialAppearance.theme, initialAppearance.fontSize)
subscribeSystemThemeChange(() => {
  const settings = readStoredAppearanceSettings()
  if (settings.theme === 'auto') applyDocumentAppearance(settings.theme, settings.fontSize)
})

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
