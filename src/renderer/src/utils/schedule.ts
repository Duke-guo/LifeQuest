import type { Task, Plan, CalendarEvent, Weather, Mood } from '../../../shared/types'

/** 把任务/日程转成日历事件 */
export function eventsFromTasks(tasks: Task[]): CalendarEvent[] {
  const out: CalendarEvent[] = []
  for (const t of tasks) {
    if (!t.due || t.status === 'archived') continue
    out.push({
      id: `task-${t.id}`,
      date: t.due,
      kind: t.kind === 'schedule' ? 'schedule' : 'task',
      title: t.title,
      time: t.startTime ?? undefined,
      endTime: t.endTime ?? undefined,
      refId: t.id,
      meta: { importance: t.importance, status: t.status, location: t.location }
    })
  }
  return out
}

/** 把活动计划展开为区间内的每日事件 */
export function eventsFromPlans(plans: Plan[], maxDays = 180): CalendarEvent[] {
  const out: CalendarEvent[] = []
  for (const p of plans) {
    if (!p.start || !p.end) continue
    let cur = new Date(p.start)
    const end = new Date(p.end)
    let n = 0
    while (cur <= end && n < maxDays) {
      out.push({
        id: `plan-${p.id}-${n}`,
        date: toStr(cur),
        kind: 'plan',
        title: p.title,
        refId: p.id
      })
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)
      n++
    }
  }
  return out
}

function toStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ===================== 日程冲突检测（B15） =====================

export interface Conflict {
  a: Task
  b: Task
}

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function overlaps(a: Task, b: Task): boolean {
  if (!a.startTime || !a.endTime || !b.startTime || !b.endTime) return false
  return toMin(a.startTime) < toMin(b.endTime) && toMin(b.startTime) < toMin(a.endTime)
}

/** 找出某天与给定日程时间冲突的其它日程 */
export function findConflicts(tasks: Task[], candidate: Task): Conflict[] {
  if (candidate.kind !== 'schedule' || !candidate.due || !candidate.startTime || !candidate.endTime) return []
  const sameDay = tasks.filter(
    (t) =>
      t.id !== candidate.id &&
      t.kind === 'schedule' &&
      t.due === candidate.due &&
      t.status !== 'archived' &&
      t.startTime &&
      t.endTime
  )
  const out: Conflict[] = []
  for (const t of sameDay) {
    if (overlaps(candidate, t)) out.push({ a: candidate, b: t })
  }
  return out
}

/** 某天所有日程之间的冲突 */
export function conflictsOn(tasks: Task[], date: string): Conflict[] {
  const items = tasks.filter(
    (t) => t.kind === 'schedule' && t.due === date && t.status !== 'archived' && t.startTime && t.endTime
  )
  const out: Conflict[] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overlaps(items[i], items[j])) out.push({ a: items[i], b: items[j] })
    }
  }
  return out
}

// ===================== 天气 / 心情（B8 / B9） =====================

export const WEATHER_META: Record<Weather, { label: string; color: string }> = {
  sunny: { label: '晴', color: '#e8a33d' },
  cloudy: { label: '多云', color: '#8d9aa8' },
  rain: { label: '雨', color: '#5b8def' },
  snow: { label: '雪', color: '#9fc6e8' },
  wind: { label: '风', color: '#55a89f' },
  fog: { label: '雾', color: '#a9a29b' }
}

export const MOOD_META: Record<Mood, { label: string; color: string; face: string }> = {
  great: { label: '很棒', color: '#e0a12e', face: 'great' },
  good: { label: '不错', color: '#55a89f', face: 'good' },
  ok: { label: '一般', color: '#8d9aa8', face: 'ok' },
  low: { label: '低落', color: '#7f7fb0', face: 'low' },
  bad: { label: '糟糕', color: '#c9584f', face: 'bad' }
}

// ===================== 周视图概括（B6） =====================

export type WeekTag = '考试周' | '忙碌周' | '轻松周' | '放假周' | '普通周'

export interface WeekSummary {
  start: string
  end: string
  tag: WeekTag
  score: number
  scheduleCount: number
  taskCount: number
}

const EXAM_HINTS = ['考', '试', '期末', '期中', '测验']
const HOLIDAY_HINTS = ['假', '放假', '旅行', '旅游', '春假', '寒假', '暑假']

/** 按任务/日程密度与关键词概括一周 */
export function summarizeWeek(tasks: Task[], weekStart: Date): WeekSummary {
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)
    days.push(toStr(d))
  }
  const inWeek = tasks.filter((t) => t.due && days.includes(t.due) && t.status !== 'archived')
  const schedules = inWeek.filter((t) => t.kind === 'schedule')
  const score = inWeek.reduce((s, t) => s + (t.importance || 3), 0)
  const text = inWeek.map((t) => t.title).join(' ')

  let tag: WeekTag = '普通周'
  if (EXAM_HINTS.some((h) => text.includes(h))) tag = '考试周'
  else if (HOLIDAY_HINTS.some((h) => text.includes(h))) tag = '放假周'
  else if (inWeek.length >= 12) tag = '忙碌周'
  else if (inWeek.length <= 3) tag = '轻松周'

  return { start: days[0], end: days[6], tag, score, scheduleCount: schedules.length, taskCount: inWeek.length }
}
