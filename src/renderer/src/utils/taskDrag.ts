import { ref } from 'vue'

/** 任务列表里拖拽建附属关系时的共享状态：正在拖谁、悬停在谁上面 */
export const draggingTaskId = ref<string | null>(null)
export const dropTargetId = ref<string | null>(null)

export function clearDrag(): void {
  draggingTaskId.value = null
  dropTargetId.value = null
}
