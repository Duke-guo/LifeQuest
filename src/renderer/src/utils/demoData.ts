import { dataApi } from '../services/data'
import { todayStr } from './helpers'
import type { Task, Season, Plan } from '../../../shared/types'

/**
 * 首次体验模板：给刚下载的人一份「示例数据」，让他几分钟内看明白每个页面长什么样。
 * 所有示例都带「示例」前缀、固定 id，并记在 config/demo.json 里，
 * 所以「清空示例」能精准删掉、绝不误伤真实数据。
 */

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** 这周的周一（周日算上一周的最后一天） */
function lastMonday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const wd = dt.getDay()
  const back = wd === 0 ? 6 : wd - 1
  return addDays(iso, -back)
}

export async function hasDemo(): Promise<boolean> {
  const d = await dataApi.readDemo()
  return !!(d?.loaded && (d.seasonIds.length || d.taskIds.length || d.planIds.length || d.noteFiles.length))
}

export async function loadDemo(): Promise<void> {
  const today = todayStr()
  const mon = lastMonday(today)

  // ---- 赛季 ----
  const seasonId = 'demo-fall'
  const seasonsFile = await dataApi.readSeasons()
  const seasons = seasonsFile?.seasons ?? []
  if (!seasons.some((s) => s.id === seasonId)) {
    seasons.push({
      id: seasonId,
      name: '示例 · 我的学期',
      type: 'main',
      start: addDays(mon, -14),
      end: addDays(mon, 84),
      status: 'active',
      categories: ['示例课程', '示例计划']
    })
    await dataApi.writeSeasons({ schemaVersion: 1, seasons })
  }

  // ---- 任务 ----
  const tasksFile = await dataApi.readTasks()
  const tasks = tasksFile?.tasks ?? []
  const push = (t: Task): void => {
    if (!tasks.some((x) => x.id === t.id)) tasks.push(t)
  }
  const base = (id: string, partial: Partial<Task>): Task => ({
    id,
    kind: 'task',
    type: 'main',
    title: id,
    description: '',
    importance: 3,
    status: 'todo',
    seasonId: null,
    parentId: null,
    due: null,
    dueTime: null,
    startTime: null,
    endTime: null,
    location: null,
    remindMinutes: null,
    repeat: 'none',
    repeatEvery: null,
    repeatUntil: null,
    skipOccurrences: [],
    occurrences: [],
    chains: [],
    tags: [],
    tagIds: [],
    linkedNoteIds: [],
    showOnHome: false,
    doneDates: [],
    createdAt: new Date().toISOString(),
    completedAt: null,
    ...partial
  })

  push(base('demo-math', {
    title: '示例 · 高等数学',
    description: '这是一条示例课程：每周一 08:00 上课，可以点日历按钮看看它的所有上课日期。',
    kind: 'schedule', type: 'main', importance: 5,
    seasonId, due: mon, startTime: '08:00', endTime: '09:50',
    location: '二教 405', remindMinutes: 15,
    repeat: 'weekly', repeatUntil: addDays(mon, 56)
  }))
  push(base('demo-english', {
    title: '示例 · 大学英语',
    description: '周三的英语课，也是一条每周重复的日程。',
    kind: 'schedule', type: 'main', importance: 4,
    seasonId, due: addDays(mon, 2), startTime: '10:00', endTime: '11:50',
    location: '文史楼 309', repeat: 'weekly', repeatUntil: addDays(mon, 56)
  }))
  push(base('demo-daily', {
    title: '示例 · 每日背单词',
    description: '一个每日习惯：每天打卡一次。',
    type: 'daily', importance: 2,
    due: addDays(today, -2), repeat: 'daily'
  }))
  push(base('demo-ddl', {
    title: '示例 · 交数学作业',
    description: '一条截止型任务：日历上会插一面小旗，越接近截止越醒目。',
    type: 'side', importance: 3,
    due: addDays(today, 3), dueTime: '23:59', showOnHome: true
  }))
  await dataApi.writeTasks({ schemaVersion: 1, tasks })

  // ---- 活动计划 ----
  const plansFile = await dataApi.readPlans()
  const plans = plansFile?.plans ?? []
  const planId = 'demo-plan-1'
  if (!plans.some((p) => p.id === planId)) {
    const plan: Plan = {
      schemaVersion: 1,
      id: planId,
      title: '示例 · 期中复习周',
      start: addDays(today, 14),
      end: addDays(today, 20),
      seasonId,
      notes: '这是一条示例计划：它会铺满这段日期的每一天，在月视图里显示成一条靛蓝标签。',
      taskIds: []
    }
    plans.push(plan)
    await dataApi.writePlans({ schemaVersion: 1, plans })
  }

  // ---- 笔记 ----
  const note1 = 'demo-note-1.md'
  const note2 = 'demo-note-2.md'
  await dataApi.writeMarkdown(
    `notes/${note1}`,
    `---\ntitle: 示例 · 高数笔记：极限\ndate: ${addDays(today, -1)}\ncategory: 数学\ntheme: 数学\n---\n\n# 极限\n\nε-δ 定义的直觉：无限接近，但不一定到达。\n\n可以给这篇笔记加标签、把它关联到「示例 · 高等数学」这节课，然后去「知识地图」看它们怎么连起来。`
  )
  await dataApi.writeMarkdown(
    `notes/${note2}`,
    `---\ntitle: 示例 · 英语单词本\ndate: ${today}\ncategory: 英语\ntheme: 英语\n---\n\n# 单词本\n\n- abandon 放弃\n- accomplish 完成\n- schedule 日程\n`
  )

  // ---- 日记（只在没写过的那天写，避免覆盖真实内容） ----
  const journalDates: string[] = []
  for (const d of [addDays(today, -1), today]) {
    const existing = await dataApi.readMarkdown(`journal/${d}.md`).catch(() => '')
    if (existing && existing.trim()) continue
    await dataApi.writeMarkdown(
      `journal/${d}.md`,
      `---\ndate: ${d}\nweather: sunny\nmood: good\n---\n\n今天开始用 LifeQuest，先记一笔。以后这里每天都能写日记，日历和主线地图上会留下印记。`
    )
    journalDates.push(d)
  }

  // ---- 记录清单 ----
  await dataApi.writeDemo({
    schemaVersion: 1,
    loaded: true,
    seasonIds: [seasonId],
    taskIds: ['demo-math', 'demo-english', 'demo-daily', 'demo-ddl'],
    planIds: [planId],
    noteFiles: [note1, note2],
    journalDates
  })
}

export async function clearDemo(): Promise<void> {
  const d = await dataApi.readDemo()
  if (!d) return

  for (const f of d.noteFiles) await dataApi.deleteFile(`notes/${f}`).catch(() => undefined)
  for (const dt of d.journalDates) await dataApi.deleteFile(`journal/${dt}.md`).catch(() => undefined)

  const seasonsFile = await dataApi.readSeasons()
  await dataApi.writeSeasons({
    schemaVersion: 1,
    seasons: (seasonsFile?.seasons ?? []).filter((s) => !d.seasonIds.includes(s.id))
  })
  const tasksFile = await dataApi.readTasks()
  await dataApi.writeTasks({
    schemaVersion: 1,
    tasks: (tasksFile?.tasks ?? []).filter((t) => !d.taskIds.includes(t.id))
  })
  const plansFile = await dataApi.readPlans()
  await dataApi.writePlans({
    schemaVersion: 1,
    plans: (plansFile?.plans ?? []).filter((p) => !d.planIds.includes(p.id))
  })

  await dataApi.writeDemo({
    schemaVersion: 1,
    loaded: false,
    seasonIds: [],
    taskIds: [],
    planIds: [],
    noteFiles: [],
    journalDates: []
  })
}
