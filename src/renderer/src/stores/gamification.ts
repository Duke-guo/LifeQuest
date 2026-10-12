import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dataApi } from '../services/data'
import { todayStr } from '../utils/helpers'
import { useSeasonsStore } from './seasons'
import type {
  AchievementsFile,
  CustomAchievement,
  AchievementMetric,
  Task
} from '../../../shared/types'

/** 里程碑：系统内置，进度从本地数据实时算出来，点亮日期写进 achievements.json */
export interface MilestoneState {
  id: string
  name: string
  desc: string
  icon: string
  progress: number
  target: number
  achieved: boolean
  unlockedAt: string | null
}

export interface CustomState {
  id: string
  name: string
  metric: AchievementMetric
  target: number
  progress: number
  achieved: boolean
  /** 关联的赛季 id（空 = 全局） */
  seasonId?: string | null
}

const METRIC_LABEL: Record<AchievementMetric, string> = {
  tasks: '完成任务',
  daily: '每日打卡',
  notes: '笔记',
  journals: '日记'
}

/** 里程碑定义：progress 是一个从「上下文」里取数字的函数 */
interface MilestoneDef {
  id: string
  name: string
  desc: string
  icon: string
  target: number
  progress: (c: Ctx) => number
}

interface Ctx {
  journals: number
  weeklyJournals: number
  notes: number
  doneTasks: number
  doneMain: number
  dailyDone: number
  noteTaskLinks: number
  customDays: number
}

const MILESTONES: MilestoneDef[] = [
  // 生活记录
  { id: 'm-journal-1', name: '第一缕晨光', desc: '写第 1 篇日记', icon: 'journal', target: 1, progress: (c) => c.journals },
  { id: 'm-journal-7', name: '七日回响', desc: '日记满 7 篇', icon: 'journal', target: 7, progress: (c) => c.journals },
  { id: 'm-journal-30', name: '生活史官', desc: '日记满 30 篇', icon: 'sparkle', target: 30, progress: (c) => c.journals },
  { id: 'm-weekly-1', name: '周末复盘', desc: '写第 1 篇周记', icon: 'notes', target: 1, progress: (c) => c.weeklyJournals },
  // 任务
  { id: 'm-task-1', name: '迈出第一步', desc: '完成第 1 个任务', icon: 'tasks', target: 1, progress: (c) => c.doneTasks },
  { id: 'm-task-main', name: '主线推进者', desc: '完成第 1 个主线任务', icon: 'compass', target: 1, progress: (c) => c.doneMain },
  { id: 'm-task-20', name: '收官者', desc: '累计完成 20 个任务', icon: 'star', target: 20, progress: (c) => c.doneTasks },
  { id: 'm-daily-7', name: '打卡达人', desc: '完成 7 个每日任务', icon: 'calendar', target: 7, progress: (c) => c.dailyDone },
  // 笔记 / 知识
  { id: 'm-note-1', name: '第一页', desc: '写第 1 篇笔记', icon: 'notes', target: 1, progress: (c) => c.notes },
  { id: 'm-note-10', name: '知识管家', desc: '笔记满 10 篇', icon: 'sparkle', target: 10, progress: (c) => c.notes },
  { id: 'm-link-1', name: '织网者', desc: '第一次把笔记关联到任务', icon: 'map', target: 1, progress: (c) => c.noteTaskLinks },
  // 探索
  { id: 'm-dayphase-1', name: '布局师', desc: '第一次给日历手动指定某天的性质', icon: 'calendar', target: 1, progress: (c) => c.customDays }
]

/** 称号阶梯：越往上越有「生活史官」的味道 */
interface TitleLadder {
  metric: keyof Ctx | 'journals'
  label: string
  tiers: { min: number; name: string }[]
}

const LADDERS: TitleLadder[] = [
  { metric: 'journals', label: '记录', tiers: [{ min: 0, name: '过客' }, { min: 1, name: '记录者' }, { min: 30, name: '生活史官' }] },
  { metric: 'notes', label: '知识', tiers: [{ min: 0, name: '空手' }, { min: 3, name: '整理师' }, { min: 10, name: '知识管家' }] },
  { metric: 'doneTasks', label: '行动', tiers: [{ min: 0, name: '新人' }, { min: 5, name: '行动派' }, { min: 20, name: '收官者' }] }
]

export const useGamificationStore = defineStore('gamification', () => {
  const seasonsStore = useSeasonsStore()

  const xp = ref(0)
  const milestones = ref<MilestoneState[]>([])
  const custom = ref<CustomState[]>([])
  /** 里程碑点亮日期缓存（id -> YYYY-MM-DD），用于持久化 */
  const unlocked = ref<Record<string, string>>({})
  const ctx = ref<Ctx>({
    journals: 0,
    weeklyJournals: 0,
    notes: 0,
    doneTasks: 0,
    doneMain: 0,
    dailyDone: 0,
    noteTaskLinks: 0,
    customDays: 0
  })

  const level = computed(() => Math.floor(xp.value / 100) + 1)

  /** 每个维度的称号与进度（用于展示阶梯） */
  const titles = computed(() =>
    LADDERS.map((l) => {
      const v = ctx.value[l.metric as 'journals' | 'notes' | 'doneTasks']
      const idx = [...l.tiers].reverse().find((t) => v >= t.min) ?? l.tiers[0]
      const tierIndex = l.tiers.indexOf(idx)
      const next = l.tiers[tierIndex + 1] ?? null
      return {
        label: l.label,
        name: idx.name,
        value: v,
        tier: tierIndex,
        nextName: next?.name ?? null,
        nextNeed: next?.min ?? null
      }
    })
  )

  /** 主称号：三个维度里层级最高的那个；同层时按「记录 > 行动 > 知识」取 */
  const mainTitle = computed(() => {
    const order = ['记录', '行动', '知识'] as const
    let best = titles.value[0]
    for (const o of order) {
      const t = titles.value.find((x) => x.label === o)!
      if (t.tier > best.tier || (t.tier === best.tier && o === '记录')) best = t
    }
    return best.name
  })

  async function refresh(): Promise<void> {
    const [tasksFile, noteFiles, journals, linksFile, dayNotes, achFile] = await Promise.all([
      dataApi.readTasks(),
      dataApi.listFiles('notes', '.md'),
      dataApi.listFiles('journal', '.md'),
      dataApi.readLinks(),
      dataApi.readDayNotes(),
      dataApi.readAchievements()
    ])
    await seasonsStore.load()

    const tasks = tasksFile?.tasks ?? []
    const dailyJournal = journals.filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    const weeklyJournal = journals.filter((f) => !/^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    const noteTaskLinks =
      (linksFile?.links ?? []).filter(
        (l) =>
          (l.from.kind === 'note' && l.to.kind === 'task') ||
          (l.from.kind === 'task' && l.to.kind === 'note')
      ).length
    const customDays = (dayNotes?.days ?? []).filter((d) => d.phase && d.phase !== 'auto').length

    const c: Ctx = {
      journals: dailyJournal.length,
      weeklyJournals: weeklyJournal.length,
      notes: noteFiles.length,
      doneTasks: tasks.filter((t) => t.status === 'done').length,
      doneMain: tasks.filter((t) => t.type === 'main' && t.status === 'done').length,
      dailyDone: tasks.filter((t) => t.type === 'daily' && t.status === 'done').length,
      noteTaskLinks,
      customDays
    }
    ctx.value = c

    xp.value = c.doneTasks * 10 + c.notes * 5 + c.journals * 5

    const storedUnlocked = achFile?.unlocked ?? {}
    unlocked.value = { ...storedUnlocked }

    let newly = false
    milestones.value = MILESTONES.map((m) => {
      const progress = Math.min(m.progress(c), 9999)
      const achieved = progress >= m.target
      let at = storedUnlocked[m.id] ?? null
      if (achieved && !at) {
        at = todayStr()
        unlocked.value[m.id] = at
        newly = true
      }
      return { id: m.id, name: m.name, desc: m.desc, icon: m.icon, progress, target: m.target, achieved, unlockedAt: at }
    })

    // 自定义成就：可能只统计某个赛季区间内的数据
    const noteDates = await readNoteDates(noteFiles)
    custom.value = (achFile?.custom ?? []).map((a) => {
      const progress = Math.min(customProgress(a, c, tasks, noteDates, dailyJournal), 9999)
      return {
        id: a.id,
        name: a.name,
        metric: a.metric,
        target: a.target,
        progress,
        achieved: progress >= a.target,
        seasonId: a.seasonId ?? null
      }
    })

    if (newly) await persistUnlocked()
  }

  /** 读每篇笔记 front matter 里的 date（自定义成就按赛季统计需要） */
  async function readNoteDates(noteFiles: string[]): Promise<string[]> {
    const out: string[] = []
    for (const f of noteFiles) {
      try {
        const raw = await dataApi.readMarkdown(`notes/${f}`)
        const m = /^---\n([\s\S]*?)\n---/.exec(raw)
        const fm = m?.[1] ?? ''
        const dm = /^date:\s*["']?(\d{4}-\d{2}-\d{2})/m.exec(fm)
        if (dm) out.push(dm[1])
      } catch {
        /* 忽略读不出的 */
      }
    }
    return out
  }

  function customProgress(
    a: CustomAchievement,
    c: Ctx,
    tasks: Task[],
    noteDates: string[],
    dailyJournal: string[]
  ): number {
    const season = a.seasonId ? seasonsStore.seasons.find((s) => s.id === a.seasonId) : null
    const inRange = (d: string): boolean =>
      !!season && !!d && d >= season.start && d <= season.end
    switch (a.metric) {
      case 'tasks': {
        if (!season) return c.doneTasks
        return tasks.filter((t) => {
          if (t.status !== 'done') return false
          if (t.seasonId === a.seasonId) return true
          return t.completedAt ? inRange(t.completedAt.slice(0, 10)) : false
        }).length
      }
      case 'daily': {
        if (!season) return c.dailyDone
        return tasks.filter((t) => t.type === 'daily' && t.status === 'done' && t.completedAt && inRange(t.completedAt.slice(0, 10))).length
      }
      case 'notes': {
        return season ? noteDates.filter(inRange).length : c.notes
      }
      case 'journals': {
        return season ? dailyJournal.filter((f) => inRange(f.slice(0, 10))).length : c.journals
      }
    }
  }

  async function persistUnlocked(): Promise<void> {
    const cur = await dataApi.readAchievements()
    const file: AchievementsFile = {
      schemaVersion: 1,
      achievements: cur?.achievements ?? [],
      unlocked: { ...unlocked.value },
      custom: cur?.custom ?? []
    }
    await dataApi.writeAchievements(file)
  }

  async function addCustom(
    name: string,
    metric: AchievementMetric,
    target: number,
    seasonId?: string | null
  ): Promise<void> {
    const n = name.trim()
    if (!n || target < 1) return
    const cur = await dataApi.readAchievements()
    const id = `c-${Date.now().toString(36)}`
    const item: CustomAchievement = { id, name: n, metric, target: Math.round(target), seasonId: seasonId || null }
    const file: AchievementsFile = {
      schemaVersion: 1,
      achievements: cur?.achievements ?? [],
      unlocked: cur?.unlocked ?? unlocked.value,
      custom: [...(cur?.custom ?? []), item]
    }
    await dataApi.writeAchievements(file)
    await refresh()
  }

  async function removeCustom(id: string): Promise<void> {
    const cur = await dataApi.readAchievements()
    const file: AchievementsFile = {
      schemaVersion: 1,
      achievements: cur?.achievements ?? [],
      unlocked: cur?.unlocked ?? unlocked.value,
      custom: (cur?.custom ?? []).filter((a) => a.id !== id)
    }
    await dataApi.writeAchievements(file)
    await refresh()
  }

  return { xp, level, milestones, custom, titles, mainTitle, refresh, addCustom, removeCustom, METRIC_LABEL }
})
