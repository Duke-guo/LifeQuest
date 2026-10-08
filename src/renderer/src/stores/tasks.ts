import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dataApi } from '../services/data'
import type { Task, TasksFile, TaskType, TaskStatus, TaskKind } from '../../../shared/types'
import { uid } from '../utils/helpers'

export interface NewTaskInput {
  title: string
  type: TaskType
  kind?: TaskKind
  importance: number
  due: string | null
  startTime?: string | null
  endTime?: string | null
  location?: string | null
  remindMinutes?: number | null
  seasonId?: string | null
  tagIds?: string[]
  linkedNoteIds?: string[]
  repeat?: 'none' | 'weekly' | 'monthly'
  repeatUntil?: string | null
  description?: string
}

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const loaded = ref(false)

  async function load(): Promise<void> {
    const file = await dataApi.readTasks()
    tasks.value = (file?.tasks ?? []).map((t) => ({
      ...t,
      kind: t.kind ?? 'task',
      startTime: t.startTime ?? null,
      endTime: t.endTime ?? null,
      location: t.location ?? null,
      remindMinutes: t.remindMinutes ?? null,
      repeat: t.repeat ?? 'none',
      repeatUntil: t.repeatUntil ?? null,
      tagIds: t.tagIds ?? [],
      linkedNoteIds: t.linkedNoteIds ?? []
    }))
    loaded.value = true
  }

  async function persist(): Promise<void> {
    const file: TasksFile = { schemaVersion: 1, tasks: tasks.value }
    await dataApi.writeTasks(file)
  }

  async function addTask(input: NewTaskInput): Promise<Task> {
    const task: Task = {
      id: uid(),
      kind: input.kind ?? (input.startTime ? 'schedule' : 'task'),
      type: input.type,
      title: input.title,
      description: input.description ?? '',
      importance: input.importance,
      status: 'todo',
      seasonId: input.seasonId ?? null,
      parentId: null,
      due: input.due,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      location: input.location ?? null,
      remindMinutes: input.remindMinutes ?? null,
      repeat: input.repeat ?? 'none',
      repeatUntil: input.repeatUntil ?? null,
      tags: [],
      tagIds: input.tagIds ?? [],
      linkedNoteIds: input.linkedNoteIds ?? [],
      createdAt: new Date().toISOString(),
      completedAt: null
    }
    tasks.value.push(task)
    await persist()
    return task
  }

  async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
    const t = tasks.value.find((x) => x.id === id)
    if (!t) return
    Object.assign(t, patch)
    await persist()
  }

  async function setStatus(id: string, status: TaskStatus): Promise<void> {
    const t = tasks.value.find((x) => x.id === id)
    if (!t) return
    t.status = status
    t.completedAt = status === 'done' ? new Date().toISOString() : null
    await persist()
  }

  async function removeTask(id: string): Promise<void> {
    tasks.value = tasks.value.filter((x) => x.id !== id)
    await persist()
  }

  /** 按类型分组，重要度从高到低 */
  const byType = computed(() => (type: TaskType) =>
    tasks.value
      .filter((t) => t.type === type && t.status !== 'archived')
      .sort((a, b) => b.importance - a.importance)
  )

  const tasksOnDate = computed(() => (date: string) => tasks.value.filter((t) => t.due === date))

  /** 某天的日程（带时间），按开始时间排序 */
  const schedulesOn = computed(() => (date: string) =>
    tasks.value
      .filter((t) => t.kind === 'schedule' && t.due === date && t.status !== 'archived')
      .sort((a, b) => (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99'))
  )

  return {
    tasks,
    loaded,
    load,
    persist,
    addTask,
    updateTask,
    setStatus,
    removeTask,
    byType,
    tasksOnDate,
    schedulesOn
  }
})
