import { reactive } from 'vue'

interface MenuAction {
  label: string
  icon?: any
  danger?: boolean
  handler: () => void
}

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  actions: MenuAction[]
}

const state = reactive<ContextMenuState>({
  visible: false,
  x: 0,
  y: 0,
  actions: [],
})

let longPressTimer: ReturnType<typeof setTimeout> | null = null
let startX = 0
let startY = 0

const LONG_PRESS_MS = 500
const MOVE_TOLERANCE = 10
let openedAt = 0

function onScroll() {
  if (state.visible) {
    state.visible = false
    state.actions = []
  }
}

export function useContextMenu() {
  function show(e: MouseEvent | TouchEvent, actions: MenuAction[]) {
    if (e.cancelable) {
      e.preventDefault()
    }
    e.stopPropagation()

    const pos = getPosition(e)
    const menuWidth = 180
    const menuHeight = actions.length * 52 + 16
    const pad = 8

    let x = pos.x
    let y = pos.y

    if (x + menuWidth > window.innerWidth - pad) x = window.innerWidth - menuWidth - pad
    if (x < pad) x = pad
    if (y + menuHeight > window.innerHeight - pad) y = window.innerHeight - menuHeight - pad
    if (y < pad) y = pad

    state.x = x
    state.y = y
    state.actions = actions
    state.visible = true
    openedAt = Date.now()
    window.addEventListener('scroll', onScroll, { capture: true, once: true })
  }

  function close() {
    state.visible = false
    state.actions = []
    window.removeEventListener('scroll', onScroll, true)
  }

  function hide() {
    if (Date.now() - openedAt < 300) return
    close()
  }

  function onTouchStart(e: TouchEvent, actions: MenuAction[]) {
    const touch = e.touches[0]
    startX = touch.clientX
    startY = touch.clientY
    longPressTimer = setTimeout(() => {
      show(e, actions)
    }, LONG_PRESS_MS)
  }

  function onTouchMove(e: TouchEvent) {
    const touch = e.touches[0]
    if (Math.abs(touch.clientX - startX) > MOVE_TOLERANCE || Math.abs(touch.clientY - startY) > MOVE_TOLERANCE) {
      cancelLongPress()
    }
  }

  function onTouchEnd() {
    cancelLongPress()
  }

  function onMouseDown(e: MouseEvent, actions: MenuAction[]) {
    if (e.button !== 0) return
    startX = e.clientX
    startY = e.clientY
    longPressTimer = setTimeout(() => {
      show(e, actions)
    }, LONG_PRESS_MS)
  }

  function onMouseMove(e: MouseEvent) {
    if (Math.abs(e.clientX - startX) > MOVE_TOLERANCE || Math.abs(e.clientY - startY) > MOVE_TOLERANCE) {
      cancelLongPress()
    }
  }

  function onMouseUp() {
    cancelLongPress()
  }

  function cancelLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  }

  return { state, show, hide, close, onTouchStart, onTouchMove, onTouchEnd, onMouseDown, onMouseMove, onMouseUp }
}

function getPosition(e: MouseEvent | TouchEvent): { x: number; y: number } {
  if ('touches' in e && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  if ('changedTouches' in e && e.changedTouches.length > 0) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
  }
  return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY }
}
