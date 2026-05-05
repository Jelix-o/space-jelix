import { useRoute, useRouter } from 'vue-router'
import { useBrowser } from '@/composables/useBrowser'
import { useConfirm } from '@/composables/useConfirm'
import { Capacitor } from '@capacitor/core'

export function useBackButton() {
  const route = useRoute()
  const router = useRouter()
  const browser = useBrowser()
  const confirm = useConfirm()

  let listener: any = null

  async function register() {
    if (!Capacitor.isNativePlatform()) return

    const { App } = await import('@capacitor/app')

    listener = App.addListener('backButton', async () => {
      // 1. BrowserOverlay open → close it
      if (browser.state.visible) {
        browser.close()
        return
      }

      // 2. Confirm dialog open → reject it
      if (confirm.state.show) {
        confirm.onResult(false)
        return
      }

      // 3. Settings sub-panel → go back to settings index
      if (route.path === '/settings' && route.query.panel) {
        router.replace('/settings')
        return
      }

      // 4. Has history and not on home → go back
      if (route.path !== '/' && window.history.length > 1) {
        router.back()
        return
      }

      // 5. On home → confirm exit
      const confirmed = await confirm.confirm('退出应用', '确定要退出 Space Jelix 吗？', 'warning')
      if (confirmed) {
        App.exitApp()
      }
    })
  }

  function unregister() {
    listener?.remove()
    listener = null
  }

  return { register, unregister }
}
