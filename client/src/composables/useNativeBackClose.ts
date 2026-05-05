import { onMounted, onUnmounted, watch, type Ref } from 'vue'

interface BackCloseEntry {
  isOpen: () => boolean
  close: () => void
  order: number
}

const closeEntries: BackCloseEntry[] = []
let closeOrder = 0

export function requestNativeBackClose() {
  const entry = closeEntries
    .filter((item) => item.isOpen())
    .sort((a, b) => b.order - a.order)[0]

  if (!entry) return false
  entry.close()
  return true
}

export function useNativeBackClose(isOpen: Ref<boolean> | (() => boolean), close: () => void) {
  const entry: BackCloseEntry = {
    isOpen: () => typeof isOpen === 'function' ? isOpen() : isOpen.value,
    close,
    order: 0,
  }

  onMounted(() => {
    closeEntries.push(entry)
    if (entry.isOpen()) entry.order = ++closeOrder
  })

  onUnmounted(() => {
    const index = closeEntries.indexOf(entry)
    if (index >= 0) closeEntries.splice(index, 1)
  })

  watch(
    () => entry.isOpen(),
    (open) => {
      if (open) entry.order = ++closeOrder
    },
    { flush: 'sync' },
  )
}
