import { onUnmounted, watch, type Ref } from 'vue'

function setLocked(open: boolean) {
  document.documentElement.classList.toggle('modal-open', open)
  document.body.classList.toggle('modal-open', open)
}

export function useModalLock(isOpen: Ref<boolean>) {
  watch(isOpen, setLocked)
  onUnmounted(() => setLocked(false))
}
