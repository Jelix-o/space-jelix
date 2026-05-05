import { reactive } from 'vue'

const state = reactive({
  visible: false,
  url: '',
})

export function useBrowser() {
  function open(url: string) {
    state.url = url
    state.visible = true
  }

  function close() {
    state.visible = false
  }

  return { state, open, close }
}
