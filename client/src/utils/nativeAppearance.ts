import { Capacitor, SystemBarType, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import type { ThemeMode } from '@/types'

type ResolvedTheme = 'light' | 'dark'

const APPEARANCE = {
  light: {
    background: '#efe8ff',
    nativeBackground: '#efe8ff',
    systemBarsStyle: SystemBarsStyle.Light,
    statusBarStyle: Style.Light,
  },
  dark: {
    background: '#211a3e',
    nativeBackground: '#111320',
    systemBarsStyle: SystemBarsStyle.Dark,
    statusBarStyle: Style.Dark,
  },
} satisfies Record<ResolvedTheme, { background: string; nativeBackground: string; systemBarsStyle: SystemBarsStyle; statusBarStyle: Style }>

declare global {
  interface Window {
    HermesNativeTheme?: {
      getSystemTheme?(): ResolvedTheme
      setTheme(theme: ResolvedTheme, background: string): void
    }
  }
}

let colorSchemeQuery: MediaQueryList | null = null

function getColorSchemeQuery() {
  if (typeof window === 'undefined') return null
  colorSchemeQuery ??= window.matchMedia('(prefers-color-scheme: dark)')
  return colorSchemeQuery
}

function normalizeTheme(theme: unknown): ThemeMode {
  return theme === 'dark' || theme === 'light' || theme === 'auto' ? theme : 'auto'
}

export function readStoredAppearanceSettings() {
  try {
    const saved = localStorage.getItem('hermes-hub-settings')
    const settings = saved ? JSON.parse(saved) : null
    return {
      theme: normalizeTheme(settings?.theme),
      fontSize: typeof settings?.fontSize === 'number' ? settings.fontSize : undefined,
    }
  } catch {
    return { theme: 'auto' as ThemeMode, fontSize: undefined }
  }
}

export function resolveTheme(theme: ThemeMode): ResolvedTheme {
  if (theme === 'dark' || theme === 'light') return theme
  const nativeTheme = getNativeSystemTheme()
  if (nativeTheme) return nativeTheme
  return getColorSchemeQuery()?.matches ? 'dark' : 'light'
}

export function applyDocumentAppearance(theme: ThemeMode, fontSize?: number) {
  const resolvedTheme = resolveTheme(theme)
  const appearance = APPEARANCE[resolvedTheme]
  const root = document.documentElement

  root.dataset.theme = resolvedTheme
  root.style.setProperty('--system-bar-bg', appearance.background)
  updateThemeColor(appearance.background)
  syncNativeThemeBridge(resolvedTheme, appearance.nativeBackground)

  if (fontSize) {
    root.style.setProperty('--font-size', `${fontSize}px`)
  }

  void syncNativeSystemBars(resolvedTheme)
  return resolvedTheme
}

function syncNativeThemeBridge(theme: ResolvedTheme, background: string) {
  try {
    window.HermesNativeTheme?.setTheme(theme, background)
  } catch {
    // Native bridge is only available inside the Android WebView.
  }
}

function getNativeSystemTheme(): ResolvedTheme | null {
  try {
    const theme = window.HermesNativeTheme?.getSystemTheme?.()
    return theme === 'dark' || theme === 'light' ? theme : null
  } catch {
    return null
  }
}

export function subscribeSystemThemeChange(onChange: () => void) {
  const query = getColorSchemeQuery()
  if (!query) return () => {}

  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function updateThemeColor(color: string) {
  const selector = 'meta[name="theme-color"]'
  let meta = document.head.querySelector<HTMLMetaElement>(selector)
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = color
}

async function syncNativeSystemBars(theme: ResolvedTheme) {
  if (!Capacitor.isNativePlatform()) return

  const appearance = APPEARANCE[theme]

  await Promise.allSettled([
    SystemBars.show(),
    SystemBars.setStyle({ style: appearance.systemBarsStyle }),
    SystemBars.setStyle({ style: appearance.systemBarsStyle, bar: SystemBarType.StatusBar }),
    SystemBars.setStyle({ style: appearance.systemBarsStyle, bar: SystemBarType.NavigationBar }),
  ])

  await Promise.allSettled([
    StatusBar.show(),
    StatusBar.setOverlaysWebView({ overlay: true }),
    StatusBar.setBackgroundColor({ color: appearance.background }),
    StatusBar.setStyle({ style: appearance.statusBarStyle }),
  ])
}
