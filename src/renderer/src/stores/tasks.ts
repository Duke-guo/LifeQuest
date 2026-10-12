import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dataApi } from '../services/data'
import { useHistoryStore } from './history'
import type {
  Task,
  TasksFile,
  TaskType,
  TaskStatus,
  TaskKind,
  TaskOccurrence,
  TaskChain,
  RepeatMode
} from '../../../shared/types'
import { uid } from '../utils/helpers'
import { isDoneOn, isRepeating } from '../utils/schedule'

export interface NewTaskInput {
  title: string
  type: TaskType
  kind?: TaskKind
  importance: number
  due: string | null
  /** 只有截止、没有时段时可给个具体时刻（HH:mm） */
  dueTime?: string | null
  /** 挂在哪个主线任务下面 */
  parentId?: string | null
  startTime?: string | null
  endTime?: string | null
  location?: string | null
  remindMinutes?: number | null
  seasonId?: string | null
  tagIds?: string[]
  linkedNoteIds?: string[]
  repeat?: RepeatMode
  /** repeat = 'every-n' 时：隔几天一次 */
  repeatEvery?: number | null
  repeatUntil?: string | null
  skipOccurrences?: string[]
  occurrences?: TaskOccurrence[]
  chains?: TaskChain[]
  description?: string
  /** 是否在首页「重要提醒」里展示 */
  showOnHome?: boolean
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
      repeatEvery: t.repeatEvery ?? null,
      repeatUntil: t.repeatUntil ?? null,
      skipOccurrences: t.skipOccurrences ?? [],
      dueTime: t.dueTime ?? null,
      parentId: t.parentId ?? null,
      occurrences: t.occurrences ?? [],
      chains: t.chains ?? [],
      tagIds: t.tagIds ?? [],
      linkedNoteIds: t.linkedNoteIds ?? [],
      showOnHome: t.showOnHome ?? false,
      doneDates: t.doneDates ?? []
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
      due: input.due,
      dueTime: input.dueTime ?? null,
      parentId: input.parentId ?? null,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      location: input.location ?? null,
      remindMinutes: input.remindMinutes ?? null,
      repeat: input.repeat ?? 'none',
      repeatEvery: input.repeatEvery ?? null,
      repeatUntil: input.repeatUntil ?? null,
      skipOccurrences: input.skipOccurrences ?? [],
      occurrences: input.occurrences ?? [],
      chains: input.chains ?? [],
      tags: [],
      tagIds: input.tagIds ?? [],
      linkedNoteIds: input.linkedNoteIds ?? [],
      showOnHome: input.showOnHome ?? false,
      createdAt: new Date().toISOString(),
      completedAt: null
    }
    tasks.value.push(task)
    await persist()
    await useHistoryStore().record('add', task)
    return task
  }

  /** 按快照重新添加（用于「历史添加」里找回误删的项） */
  async function restoreTask(snapshot: Task): Promise<Task> {
    const task: Task = {
      ...JSON.parse(JSON.stringify(snapshot)),
      id: uid(),
      createdAt: new Date().toISOString()
    }
    tasks.value.push(task)
    await persist()
    await useHistoryStore().record('add', task)
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

  /**
   * 勾选 / 取消「完成」。
   * 重复任务带上日期时只勾这一天（勾今天不会连累后面几次）；单次任务改整体状态。
   */
  async function toggleDone(id: string, date?: string): Promise<void> {
    const t = tasks.value.find((x) => x.id === id)
    if (!t) return
    if (date && isRepeating(t)) {
      const list = new Set(t.doneDates ?? [])
      if (list.has(date)) list.delete(date)
      else list.add(date)
      t.doneDates = [...list].sort()
      await persist()
      return
    }
    await setStatus(id, t.status === 'done' ? 'todo' : 'done')
  }

  /** 某一天是否已完成（模板里直接用） */
  function doneOn(id: string, date: string): boolean {
    const t = tasks.value.find((x) => x.id === id)
    return t ? isDoneOn(t, date) : false
  }

  /**
   * 排掉某一次（放假 / 停课 / 老师调课）：这一天不再出现在日历上，
   * 也不算进进度；其它次不受影响。可以随时 unskipOccurrence 恢复。
   */
  async function skipOccurrence(id: string, date: string): Promise<void> {
    const t = tasks.value.find((x) => x.id === id)
    if (!t || !date) return
    const list = new Set(t.skipOccurrences ?? [])
    list.add(date)
    t.skipOccurrences = [...list].sort()
    // 这一天之前可能被勾过完成，排掉后把它从 doneDates 里也拿走，免得算进进度
    if (t.doneDates?.includes(date)) t.doneDates = t.doneDates.filter((d) => d !== date)
    await persist()
  }

  async function unskipOccurrence(id: string, date: string): Promise<void> {
    const t = tasks.value.find((x) => x.id === id)
    if (!t) return
    t.skipOccurrences = (t.skipOccurrences ?? []).filter((d) => d !== date)
    await persist()
  }

  async function removeTask(id: string): Promise<void> {
    const victim = tasks.value.find((x) => x.id === id)
    tasks.value = tasks.value.filter((x) => x.id !== id)
    await persist()
    if (victim) await useHistoryStore().record('delete', victim)
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
    restoreTask,
    updateTask,
    setStatus,
    toggleDone,
    doneOn,
    skipOccurrence,
    unskipOccurrence,
    removeTask,
    byType,
    tasksOnDate,
    schedulesOn
  }
})
