import { ref } from 'vue'

/** 任务列表里拖拽建附属关系时的共享状态：正在拖谁、悬停在谁上面 */
export const draggingTaskId = ref<string | null>(null)
export const dropTargetId = ref<string | null>(null)

export function clearDrag(): void {
  draggingTaskId.value = null
  dropTargetId.value = null
  stopAutoScroll()
}

/**
 * 拖到窗口上下边缘时自动滚动页面。
 * 列表可能很长，两条任务离得远时不这样根本拖不过去。
 */
const EDGE = 110
const SPEED = 16
let ticking = false

function onDragMove(e: DragEvent): void {
  if (!draggingTaskId.value) return
  const y = e.clientY
  const h = window.innerHeight
  if (y < EDGE) window.scrollBy(0, -SPEED * ((EDGE - y) / EDGE + 0.35))
  else if (y > h - EDGE) window.scrollBy(0, SPEED * ((y - (h - EDGE)) / EDGE + 0.35))
}

export function startAutoScroll(): void {
  if (ticking) return
  ticking = true
  window.addEventListener('dragover', onDragMove, true)
}

export function stopAutoScroll(): void {
  if (!ticking) return
  ticking = false
  window.removeEventListener('dragover', onDragMove, true)
}
