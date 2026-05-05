import { useBrowser } from '@/composables/useBrowser'

export async function openUrl(url: string) {
  const browser = useBrowser()
  browser.open(url)
}
