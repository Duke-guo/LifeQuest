import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dataApi } from '../services/data'
import type { HistoryEntry, HistoryFile, Task } from '../../../shared/types'
import { uid } from '../utils/helpers'

const MAX = 60

/** 添加/删除历史：误删后可以一键找回 */
export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>([])
  const loaded = ref(false)

  async function load(): Promise<void> {
    const file = await dataApi.readHistory()
    entries.value = file?.entries ?? []
    loaded.value = true
  }

  async function persist(): Promise<void> {
    const file: HistoryFile = { schemaVersion: 1, entries: entries.value.slice(0, MAX) }
    await dataApi.writeHistory(file)
  }

  /** 记录一次添加或删除 */
  async function record(action: 'add' | 'delete', task: Task): Promise<void> {
    const snapshot: Task = JSON.parse(JSON.stringify(task))
    // 同一条重复操作只保留最新一条
    entries.value = entries.value.filter((e) => !(e.task.id === task.id && e.action === action))
    entries.value.unshift({ id: uid(), at: new Date().toISOString(), action, task: snapshot })
    if (entries.value.length > MAX) entries.value = entries.value.slice(0, MAX)
    await persist()
  }

  async function clear(): Promise<void> {
    entries.value = []
    await persist()
  }

  /** 最近删除的（最需要找回的） */
  const deleted = computed(() => entries.value.filter((e) => e.action === 'delete'))
  const added = computed(() => entries.value.filter((e) => e.action === 'add'))

  return { entries, loaded, deleted, added, load, persist, record, clear }
})
