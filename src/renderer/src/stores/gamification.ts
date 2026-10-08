import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dataApi } from '../services/data'

export interface AchievementState {
  id: string
  name: string
  desc: string
  progress: number
  target: number
  achieved: boolean
}

export const useGamificationStore = defineStore('gamification', () => {
  const xp = ref(0)
  const achievements = ref<AchievementState[]>([])

  const level = computed(() => Math.floor(xp.value / 100) + 1)

  async function refresh(): Promise<void> {
    const tasksFile = await dataApi.readTasks()
    const notes = await dataApi.listFiles('notes', '.md')
    const journals = await dataApi.listFiles('journal', '.md')
    const tasks = tasksFile?.tasks ?? []
    const done = tasks.filter((t) => t.status === 'done').length
    const dailyDone = tasks.filter((t) => t.type === 'daily' && t.status === 'done').length

    xp.value = done * 10 + notes.length * 5 + journals.length * 5

    const defs: Array<Omit<AchievementState, 'achieved'>> = [
      { id: 'task-master', name: '任务达人', desc: '完成 5 个任务', progress: done, target: 5 },
      { id: 'checkin-master', name: '打卡达人', desc: '完成 7 个每日任务', progress: dailyDone, target: 7 },
      { id: 'note-master', name: '笔记达人', desc: '写 3 篇笔记', progress: notes.length, target: 3 },
      { id: 'review-master', name: '复盘达人', desc: '写 3 篇日记', progress: journals.length, target: 3 }
    ]
    achievements.value = defs.map((d) => ({ ...d, achieved: d.progress >= d.target }))
  }

  return { xp, level, achievements, refresh }
})
