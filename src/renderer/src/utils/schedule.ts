import type { Task, Plan, CalendarEvent, Weather, Mood, RepeatMode } from '../../../shared/types'

export const REPEAT_LABELS: Record<RepeatMode, string> = {
  none: '不重复',
  daily: '每天',
  weekdays: '工作日',
  weekly: '每周',
  biweekly: '每两周',
  monthly: '每月'
}

export const REPEAT_OPTIONS: RepeatMode[] = ['none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly']

/** 把任务/日程转成日历事件；重复任务按区间展开，可跳过停课日 */
export function eventsFromTasks(
  tasks: Task[],
  rangeStart?: string,
  rangeEnd?: string,
  skipDates?: Set<string>
): CalendarEvent[] {
  const out: CalendarEvent[] = []
  for (const t of tasks) {
    if (!t.due || t.status === 'archived') continue

    const mode = t.repeat && t.repeat !== 'none' ? t.repeat : null
    if (mode && rangeStart && rangeEnd) {
      // 展开区间 = [可见区间] ∩ [due, repeatUntil]
      const from = t.due > rangeStart ? t.due : rangeStart
      const until = t.repeatUntil && t.repeatUntil < rangeEnd ? t.repeatUntil : rangeEnd
      if (until < from) continue
      const dates = expandRepeat(t.due, mode, t.repeatUntil ?? null, from, until)
      dates.forEach((d, i) => {
        if (skipDates?.has(d)) return
        out.push(makeEvent(t, d, `-r${i}`))
      })
      continue
    }

    if (t.repeatUntil && t.due > t.repeatUntil) continue
    out.push(makeEvent(t, t.due, ''))
  }
  return out
}

/** 从 first 起按 mode 推进，返回落在 [from, until] 内的日期 */
function expandRepeat(
  first: string,
  mode: RepeatMode,
  repeatUntil: string | null,
  from: string,
  until: string
): string[] {
  const out: string[] = []
  const hardEnd = repeatUntil && repeatUntil < until ? repeatUntil : until
  const fromDate = parseLocal(from)
  const end = parseLocal(hardEnd)
  let cur = parseLocal(first)
  let guard = 0
  // 先推进到区间附近，避免从很久以前开始循环
  while (cur < fromDate && guard < 4000) {
    cur = nextDate(cur, mode)
    guard++
  }
  guard = 0
  while (cur <= end && guard < 800) {
    out.push(toStr(cur))
    cur = nextDate(cur, mode)
    guard++
  }
  return out
}

function nextDate(d: Date, mode: RepeatMode): Date {
  switch (mode) {
    case 'daily':
      return addDays(d, 1)
    case 'weekdays': {
      let n = addDays(d, 1)
      while (n.getDay() === 0 || n.getDay() === 6) n = addDays(n, 1)
      return n
    }
    case 'biweekly':
      return addDays(d, 14)
    case 'monthly':
      return addMonth(d)
    case 'weekly':
    default:
      return addDays(d, 7)
  }
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** 加一个月，日期溢出时收敛到当月最后一天（如 1/31 → 2/28） */
function addMonth(d: Date): Date {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const last = new Date(y, m + 1, 0).getDate()
  return new Date(y, m, Math.min(day, last))
}

function makeEvent(t: Task, date: string, suffix: string): CalendarEvent {
  return {
    id: `task-${t.id}${suffix}`,
    date,
    kind: t.kind === 'schedule' ? 'schedule' : 'task',
    title: t.title,
    time: t.startTime ?? undefined,
    endTime: t.endTime ?? undefined,
    refId: t.id,
    meta: { importance: t.importance, status: t.status, location: t.location }
  }
}

/** 把活动计划展开为区间内的每日事件 */
export function eventsFromPlans(plans: Plan[], maxDays = 180): CalendarEvent[] {
  const out: CalendarEvent[] = []
  for (const p of plans) {
    if (!p.start || !p.end) continue
    let cur = parseLocal(p.start)
    const end = parseLocal(p.end)
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

/** 一律按「本地时区」解析日期字符串。
 *  注意：new Date('2026-10-15') 是按 UTC 解析的（= 北京时间 08:00），
 *  与本地构造的 00:00 比较会差 8 小时，导致跳过/漏掉一整个周期。 */
function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
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
  /** 本周安排总时长（小时） */
  hours: number
  scheduleCount: number
  taskCount: number
}

const EXAM_HINTS = ['考', '试', '期末', '期中', '测验']
const HOLIDAY_HINTS = ['假', '放假', '旅行', '旅游', '春假', '寒假', '暑假']

/** 单个事件占用的时长（小时） */
export function eventHours(e: CalendarEvent): number {
  if (!e.time || !e.endTime) return 1
  const [sh, sm] = e.time.split(':').map(Number)
  const [eh, em] = e.endTime.split(':').map(Number)
  return Math.max(0.5, (eh * 60 + (em || 0) - sh * 60 - (sm || 0)) / 60)
}

/** 按任务/日程密度与关键词概括一周
 *  注意：必须用与日历相同的「重复展开」逻辑，否则重复课程会漏算（会误判为轻松周） */
export function summarizeWeek(
  tasks: Task[],
  weekStart: Date,
  skipDates?: Set<string>
): WeekSummary {
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    days.push(toStr(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)))
  }

  const evs = eventsFromTasks(tasks, days[0], days[6], skipDates)
  const schedules = evs.filter((e) => e.kind === 'schedule')
  const totalHours = evs.reduce((s, e) => s + eventHours(e), 0)
  const score = evs.reduce((s, e) => s + (e.meta?.importance ?? 3), 0)
  const text = evs.map((e) => e.title).join(' ')
  const skipCount = skipDates ? days.filter((d) => skipDates.has(d)).length : 0

  let tag: WeekTag = '普通周'
  if (EXAM_HINTS.some((h) => text.includes(h))) tag = '考试周'
  else if (skipCount >= 3 || HOLIDAY_HINTS.some((h) => text.includes(h))) tag = '放假周'
  else if (evs.length === 0) tag = '轻松周'
  else if (totalHours >= 24) tag = '忙碌周'
  else if (totalHours < 10) tag = '轻松周'

  return {
    start: days[0],
    end: days[6],
    tag,
    score,
    hours: Math.round(totalHours),
    scheduleCount: schedules.length,
    taskCount: evs.length
  }
}
