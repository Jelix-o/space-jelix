import { reactive } from 'vue'

interface ConfirmState {
  show: boolean
  title: string
  message: string
  type: 'warning' | 'danger' | 'info'
  resolve: ((value: boolean) => void) | null
}

const state = reactive<ConfirmState>({
  show: false,
  title: '',
  message: '',
  type: 'warning',
  resolve: null,
})

export function useConfirm() {
  function confirm(title: string, message: string, type: ConfirmState['type'] = 'warning'): Promise<boolean> {
    return new Promise((resolve) => {
      state.title = title
      state.message = message
      state.type = type
      state.resolve = resolve
      state.show = true
    })
  }

  function onResult(value: boolean) {
    state.show = false
    state.resolve?.(value)
    state.resolve = null
  }

  return {
    state,
    confirm,
    onResult,
  }
}
