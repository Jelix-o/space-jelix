import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { useRoute, useRouter } from 'vue-router'
import { useBrowser } from '@/composables/useBrowser'
import { useConfirm } from '@/composables/useConfirm'
import { useContextMenu } from '@/composables/useContextMenu'
import { requestNativeBackClose } from '@/composables/useNativeBackClose'

const ROOT_PATHS = new Set(['/', '/chat', '/generate', '/connections', '/settings'])

export function useBackButton() {
  const route = useRoute()
  const router = useRouter()
  const browser = useBrowser()
  const confirm = useConfirm()
  const contextMenu = useContextMenu()

  let listener: PluginListenerHandle | null = null

  async function register() {
    if (!Capacitor.isNativePlatform()) return

    const { App } = await import('@capacitor/app')

    listener = await App.addListener('backButton', async () => {
      if (browser.state.visible) {
        browser.close()
        return
      }

      if (confirm.state.show) {
        confirm.onResult(false)
        return
      }

      if (contextMenu.state.visible) {
        contextMenu.close()
        return
      }

      if (requestNativeBackClose()) {
        return
      }

      if (route.path === '/settings' && route.query.panel) {
        router.replace('/settings')
        return
      }

      if (ROOT_PATHS.has(route.path)) {
        const confirmed = await confirm.confirm('退出应用', '确定要退出 Space Jelix 吗？', 'warning')
        if (confirmed) App.exitApp()
        return
      }

      if (window.history.length > 1) {
        router.back()
        return
      }

      router.replace(getFallbackPath(route.path))
    })
  }

  function unregister() {
    listener?.remove()
    listener = null
  }

  return { register, unregister }
}

function getFallbackPath(path: string) {
  if (path.startsWith('/app/')) return '/'
  if (path.startsWith('/chat/')) return '/chat'
  if (path.startsWith('/terminal/')) return '/connections'
  return '/'
}
