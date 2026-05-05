import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { Keyboard, type KeyboardInfo } from '@capacitor/keyboard'

const KEYBOARD_THRESHOLD = 80

export function useKeyboardInset() {
  const handles: PluginListenerHandle[] = []
  let visualViewportEnabled = false
  let animationFrame = 0
  let layoutViewportHeight = 0
  let pendingTimer = 0

  function register() {
    document.addEventListener('pointerdown', handlePotentialKeyboardFocus, true)
    document.addEventListener('touchstart', handlePotentialKeyboardFocus, true)
    document.addEventListener('focusin', handlePotentialKeyboardFocus, true)
    document.addEventListener('focusout', handleKeyboardFocusOut, true)

    registerVisualViewportFallback()

    if (Capacitor.isNativePlatform()) {
      void registerNativeKeyboardListeners()
    }
  }

  async function unregister() {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = 0
    }

    if (pendingTimer) {
      window.clearTimeout(pendingTimer)
      pendingTimer = 0
    }

    document.removeEventListener('pointerdown', handlePotentialKeyboardFocus, true)
    document.removeEventListener('touchstart', handlePotentialKeyboardFocus, true)
    document.removeEventListener('focusin', handlePotentialKeyboardFocus, true)
    document.removeEventListener('focusout', handleKeyboardFocusOut, true)

    if (visualViewportEnabled && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', scheduleVisualViewportUpdate)
      window.visualViewport.removeEventListener('scroll', scheduleVisualViewportUpdate)
      visualViewportEnabled = false
    }

    await Promise.allSettled(handles.splice(0).map((handle) => handle.remove()))
    setKeyboardOffset(0)
  }

  async function registerNativeKeyboardListeners() {
    try {
      const show = (info: KeyboardInfo) => setKeyboardOffset(info.keyboardHeight)
      const hide = () => setKeyboardOffset(0)

      handles.push(
        await Keyboard.addListener('keyboardWillShow', show),
        await Keyboard.addListener('keyboardDidShow', show),
        await Keyboard.addListener('keyboardWillHide', hide),
        await Keyboard.addListener('keyboardDidHide', hide),
      )
    } catch {
      registerVisualViewportFallback()
    }
  }

  function registerVisualViewportFallback() {
    if (visualViewportEnabled || !window.visualViewport) return
    visualViewportEnabled = true
    layoutViewportHeight = Math.max(window.innerHeight, window.visualViewport.height)
    window.visualViewport.addEventListener('resize', scheduleVisualViewportUpdate)
    window.visualViewport.addEventListener('scroll', scheduleVisualViewportUpdate)
    updateFromVisualViewport()
  }

  function scheduleVisualViewportUpdate() {
    if (animationFrame) return
    animationFrame = window.requestAnimationFrame(() => {
      animationFrame = 0
      updateFromVisualViewport()
    })
  }

  function updateFromVisualViewport() {
    const viewport = window.visualViewport
    if (!viewport) return

    const currentViewportHeight = Math.max(window.innerHeight, viewport.height)
    if (currentViewportHeight > layoutViewportHeight || viewport.height >= layoutViewportHeight - KEYBOARD_THRESHOLD) {
      layoutViewportHeight = currentViewportHeight
    }

    const coveredBottom = Math.max(0, layoutViewportHeight - viewport.height - viewport.offsetTop)
    setKeyboardOffset(coveredBottom >= KEYBOARD_THRESHOLD ? coveredBottom : 0)
  }

  function handlePotentialKeyboardFocus(event: Event) {
    if (isEditableTarget(event.target)) markKeyboardPending()
  }

  function handleKeyboardFocusOut() {
    if (pendingTimer) window.clearTimeout(pendingTimer)
    pendingTimer = window.setTimeout(() => {
      const root = document.documentElement
      if (!root.classList.contains('keyboard-open') && !isEditableTarget(document.activeElement)) {
        clearKeyboardPending()
      }
    }, 180)
  }

  function markKeyboardPending() {
    if (pendingTimer) {
      window.clearTimeout(pendingTimer)
      pendingTimer = 0
    }
    document.documentElement.classList.add('keyboard-pending')
    document.body.classList.add('keyboard-pending')
  }

  return { register, unregister }
}

function setKeyboardOffset(offset: number) {
  const value = Math.max(0, Math.round(offset))
  const root = document.documentElement
  const open = value >= KEYBOARD_THRESHOLD

  root.style.setProperty('--keyboard-offset', `${value}px`)
  root.style.setProperty('--keyboard-nav-offset', open ? `${value}px` : '0px')
  root.classList.toggle('keyboard-open', open)
  document.body.classList.toggle('keyboard-open', open)

  if (open) {
    clearKeyboardPending()
  } else if (!isEditableTarget(document.activeElement)) {
    clearKeyboardPending()
  }
}

function clearKeyboardPending() {
  document.documentElement.classList.remove('keyboard-pending')
  document.body.classList.remove('keyboard-pending')
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('input:not([type="checkbox"]):not([type="radio"]):not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled]), [contenteditable="true"]'))
}
