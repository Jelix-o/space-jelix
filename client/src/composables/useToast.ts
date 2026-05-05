import { reactive } from 'vue'

interface ToastState {
  show: boolean
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration: number
}

const state = reactive<ToastState>({
  show: false,
  message: '',
  type: 'info',
  duration: 3000,
})

let hideTimer: ReturnType<typeof setTimeout> | null = null

export function useToast() {
  function show(message: string, type: ToastState['type'] = 'info', duration = 3000) {
    if (hideTimer) clearTimeout(hideTimer)
    state.message = message
    state.type = type
    state.duration = duration
    state.show = true
    if (duration > 0) {
      hideTimer = setTimeout(() => {
        state.show = false
      }, duration)
    }
  }

  function hide() {
    if (hideTimer) clearTimeout(hideTimer)
    state.show = false
  }

  return {
    state,
    show,
    hide,
    success: (msg: string, dur?: number) => show(msg, 'success', dur),
    error: (msg: string, dur?: number) => show(msg, 'error', dur),
    warning: (msg: string, dur?: number) => show(msg, 'warning', dur),
    info: (msg: string, dur?: number) => show(msg, 'info', dur),
  }
}
