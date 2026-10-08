import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dataApi } from '../services/data'
import type { Task, TasksFile, TaskType, TaskStatus } from '../../../shared/types'
import { uid } from '../utils/helpers'

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const loaded = ref(false)

  async function load(): Promise<void> {
    const file = await dataApi.readTasks()
    tasks.value = file?.tasks ?? []
    loaded.value = true
  }

  async function persist(): Promise<void> {
    const file: TasksFile = { schemaVersion: 1, tasks: tasks.value }
    await dataApi.writeTasks(file)
  }

  async function addTask(input: {
    title: string
    type: TaskType
    importance: number
    due: string | null
    seasonId?: string | null
    description?: string
  }): Promise<void> {
    const task: Task = {
      id: uid(),
      type: input.type,
      title: input.title,
      description: input.description ?? '',
      importance: input.importance,
      status: 'todo',
      seasonId: input.seasonId ?? null,
      parentId: null,
      due: input.due,
      tags: [],
      createdAt: new Date().toISOString(),
      completedAt: null
    }
    tasks.value.push(task)
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

  return { tasks, loaded, load, addTask, setStatus, removeTask, byType, tasksOnDate }
})
