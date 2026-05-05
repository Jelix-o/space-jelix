import { Capacitor } from '@capacitor/core'
import { useBrowser } from '@/composables/useBrowser'

export async function openUrl(url: string) {
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url })
  } else {
    const browser = useBrowser()
    browser.open(url)
  }
}
