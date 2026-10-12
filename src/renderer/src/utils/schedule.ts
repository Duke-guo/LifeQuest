import type {
  Task,
  Plan,
  CalendarEvent,
  Weather,
  Mood,
  RepeatMode,
  TaskOccurrence
} from '../../../shared/types'

export type { TaskOccurrence }

export const REPEAT_LABELS: Record<RepeatMode, string> = {
  none: '不重复',
  daily: '每天',
  weekdays: '工作日',
  weekly: '每周',
  biweekly: '每两周',
  monthly: '每月',
  'every-n': '每几天'
}

export const REPEAT_OPTIONS: RepeatMode[] = [
  'none',
  'daily',
  'weekdays',
  'weekly',
  'biweekly',
  'monthly',
  'every-n'
]

/** 「每 N 天」到底几天：没填/填错时退回 2 天 */
export function everyNDays(t: { repeatEvery?: number | null }): number {
  const n = Math.round(Number(t.repeatEvery ?? 0))
  return Number.isFinite(n) && n >= 1 ? Math.min(180, n) : 2
}

/** 重复方式的中文说法（「每 3 天」这种要带上数字） */
export function repeatLabel(mode: RepeatMode | undefined, every?: number | null): string {
  if (!mode || mode === 'none') return REPEAT_LABELS.none
  if (mode === 'every-n') return `每 ${everyNDays({ repeatEvery: every })} 天`
  return REPEAT_LABELS[mode]
}

/** 这个任务手动排掉了哪几次（放假 / 停课 / 调课） */
export function skipSetOf(t: Task): Set<string> {
  return new Set((t.skipOccurrences ?? []).filter(Boolean))
}

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

    // 「停课日」只对课表类日程生效：放假不等于不用交作业，
    // 否则把 ddl 落在节假日就整个从日历上消失了
    // 另外：任务自己排掉的某几次（skipOccurrences）只对重复事项生效
    const repeating = isRepeating(t)
    const ownSkips = skipSetOf(t)
    const skipped = (d: string): boolean =>
      (repeating && ownSkips.has(d)) || (t.kind === 'schedule' && !!skipDates?.has(d))

    const mode = t.repeat && t.repeat !== 'none' ? t.repeat : null
    let emitted = false

    if (mode && rangeStart && rangeEnd) {
      // 展开区间 = [可见区间] ∩ [due, repeatUntil]
      const from = t.due > rangeStart ? t.due : rangeStart
      const until = t.repeatUntil && t.repeatUntil < rangeEnd ? t.repeatUntil : rangeEnd
      if (until >= from) {
        const dates = expandRepeat(t.due, mode, t.repeatUntil ?? null, from, until, t.repeatEvery)
        dates.forEach((d, i) => {
          if (skipped(d)) return
          out.push(makeEvent(t, d, `-r${i}`))
        })
      }
      emitted = true
    }

    // 额外的重复链（一个任务多条：高数周二一节、周四一节）
    // 注意：必须放在上面的 continue 之前，否则有主重复的任务永远走不到这里
    const chains = t.chains ?? []
    chains.forEach((c, ci) => {
      if (!c.due || !c.repeat || c.repeat === 'none') return
      const chainSkips = new Set(c.skipOccurrences ?? [])
      const from = rangeStart && c.due < rangeStart ? rangeStart : c.due
      const untilRaw = c.repeatUntil ?? null
      const until = rangeEnd && (!untilRaw || untilRaw > rangeEnd) ? rangeEnd : untilRaw
      if (!until || until < from) return
      expandRepeat(c.due, c.repeat, untilRaw, from, until, c.repeatEvery).forEach((d, i) => {
        if (skipped(d) || chainSkips.has(d)) return
        out.push(makeEvent(t, d, `-c${ci}-${i}`, c))
      })
      emitted = true
    })

    // 不规律的逐次日期（可与固定重复并存）
    const occ = t.occurrences ?? []
    if (occ.length > 0) {
      occ.forEach((o, i) => {
        if (!o.date) return
        if (rangeStart && o.date < rangeStart) return
        if (rangeEnd && o.date > rangeEnd) return
        if (skipped(o.date)) return
        out.push(makeEvent(t, o.date, `-o${i}`, o))
      })
      emitted = true
    }

    if (emitted) continue

    if (t.repeatUntil && t.due > t.repeatUntil) continue

    // 单次事项也要落在请求区间内才返回：
    // 否则调用方只要「某一天的时长/件数」，就会被别的日子的单次事项污染
    if (rangeStart && t.due < rangeStart) continue
    if (rangeEnd && t.due > rangeEnd) continue
    if (skipped(t.due)) continue
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
  until: string,
  every?: number | null
): string[] {
  const out: string[] = []
  const hardEnd = repeatUntil && repeatUntil < until ? repeatUntil : until
  const fromDate = parseLocal(from)
  const end = parseLocal(hardEnd)
  let cur = parseLocal(first)
  let guard = 0
  // 先推进到区间附近，避免从很久以前开始循环
  while (cur < fromDate && guard < 4000) {
    cur = nextDate(cur, mode, every)
    guard++
  }
  guard = 0
  while (cur <= end && guard < 800) {
    out.push(toStr(cur))
    cur = nextDate(cur, mode, every)
    guard++
  }
  return out
}

function nextDate(d: Date, mode: RepeatMode, every?: number | null): Date {
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
    case 'every-n':
      return addDays(d, everyNDays({ repeatEvery: every }))
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

/** 这个任务是不是「一次次重复发生」的（重复规则 / 重复链 / 逐次日期都算） */
export function isRepeating(t: Task): boolean {
  if (t.repeat && t.repeat !== 'none') return true
  if ((t.chains ?? []).some((c) => c.due && c.repeat && c.repeat !== 'none')) return true
  if ((t.occurrences ?? []).length > 0) return true
  return false
}

/**
 * 重复任务在某一天算不算「已完成」：
 *  - 重复任务：看 doneDates 里有没有这一天（勾一次只勾掉这一天，不影响后面）
 *  - 单次任务：看整体 status
 */
export function isDoneOn(t: Task, date: string): boolean {
  if (isRepeating(t)) return (t.doneDates ?? []).includes(date)
  return t.status === 'done'
}

/**
 * 这一次为什么不算数：
 *  - 'own'     = 任务自己排掉的（放假 / 调课，存在 skipOccurrences）
 *  - 'holiday' = 校历里的停课日（只对日程类生效，见学期计划）
 */
export function skipReason(
  t: Task,
  date: string,
  holidaySkips?: Set<string>
): 'own' | 'holiday' | null {
  if (isRepeating(t) && skipSetOf(t).has(date)) return 'own'
  if (t.kind === 'schedule' && holidaySkips?.has(date)) return 'holiday'
  return null
}

export interface OccurrenceQuery {
  /** 上限，防跑飞 */
  cap?: number
  /** 把「不算数的那些次」也列出来（弹窗里显示成划掉 / 停课，可恢复） */
  includeSkipped?: boolean
  /** 校历停课日（学期计划里的放假），只对日程类生效 */
  holidaySkips?: Set<string>
}

/**
 * 重复任务的全部发生日期（升序去重），用于进度条与「这件事都会在哪几天」。
 * 默认只算「真的会发生」的：自己排掉的 + 校历停课的都不算。
 */
export function allOccurrences(t: Task, q: OccurrenceQuery = {}): string[] {
  const cap = q.cap ?? 400
  const set = new Set<string>()
  const repeating = isRepeating(t)
  const skips = skipSetOf(t)
  // 「排掉某几次」只对重复发生的事项有意义：单次任务排掉就等于删掉整个任务了
  const keep = (d: string): boolean => {
    const why = skipReason(t, d, q.holidaySkips)
    if (!why) return true
    if (!q.includeSkipped) return false
    // 单次任务不受自己的排掉列表影响（见上）
    return why === 'own' ? repeating : true
  }
  const mode = t.repeat && t.repeat !== 'none' ? t.repeat : null
  if (mode && t.due) {
    const until = t.repeatUntil ?? toStr(addDays(parseLocal(t.due), 370))
    for (const d of expandRepeat(t.due, mode, t.repeatUntil ?? null, t.due, until, t.repeatEvery)) {
      if (keep(d)) set.add(d)
    }
  }
  for (const c of t.chains ?? []) {
    if (!c.due || !c.repeat || c.repeat === 'none') continue
    const chainSkips = new Set(c.skipOccurrences ?? [])
    const until = c.repeatUntil ?? toStr(addDays(parseLocal(c.due), 370))
    for (const d of expandRepeat(c.due, c.repeat, c.repeatUntil ?? null, c.due, until, c.repeatEvery)) {
      if (keep(d) && !chainSkips.has(d)) set.add(d)
    }
  }
  // 逐次列出的日期：本身就是一次「明确安排」，不受 skipOccurrences 影响，
  // 但主重复里被排掉的那天如果也单独列了，就以「明确列出的」为准
  for (const o of t.occurrences ?? []) if (o.date) set.add(o.date)
  // 单次任务：只有它自己那一天
  if (!mode && set.size === 0 && t.due) set.add(t.due)
  return [...set].sort().slice(0, cap)
}

function makeEvent(
  t: Task,
  date: string,
  suffix: string,
  override?: { startTime?: string | null; endTime?: string | null }
): CalendarEvent {
  const start = override?.startTime ?? t.startTime
  const end = override?.endTime ?? t.endTime
  // 只有截止、没有时段的「任务」在日历上是一个插入旗标，不是时间块
  const isDeadline = t.kind !== 'schedule' && !start
  return {
    id: `task-${t.id}${suffix}`,
    date,
    kind: t.kind === 'schedule' ? 'schedule' : 'task',
    title: t.title,
    time: start ?? undefined,
    endTime: end ?? undefined,
    refId: t.id,
    meta: {
      importance: t.importance,
      // 重复任务按「这一次」算完成状态，勾今天不会连累后面
      status: isDoneOn(t, date) ? 'done' : 'todo',
      location: t.location,
      deadline: isDeadline
    }
  }
}

/** 截止型事项的「落点时刻」：有时刻用它，否则算当天 24:00，用于日历上的定位 */
export function deadlineTimeOf(e: CalendarEvent, t?: Task): string {
  if (e.time) return e.time
  const dt = t?.dueTime
  return dt && /^\d{2}:\d{2}$/.test(dt) ? dt : '24:00'
}

/**
 * 这个任务「下一次发生」的日期，用于从任务一键跳到日历对应那一周。
 * 单次 → 它自己的日期；重复 → 从 from 起最近的一次（跳过停课日）。
 */
export function nextOccurrence(task: Task, from: string, skipDates?: Set<string>): string | null {
  // 同 eventsFromTasks：停课日只对课表类日程生效；任务自己排掉的几次只对重复事项生效
  const repeating = isRepeating(task)
  const ownSkips = skipSetOf(task)
  const skipped = (d: string): boolean =>
    (repeating && ownSkips.has(d)) || (task.kind === 'schedule' && !!skipDates?.has(d))
  const occDates = (task.occurrences ?? [])
    .map((o) => o.date)
    .filter(Boolean)
    .filter((d) => !skipped(d))
  const future = occDates.filter((d) => d >= from).sort()
  if (future.length) return future[0]

  if (!task.due) return occDates.sort().pop() ?? null
  const mode = task.repeat && task.repeat !== 'none' ? task.repeat : null
  if (!mode) return task.due

  if (task.due >= from && !skipped(task.due)) return task.due
  const until = task.repeatUntil ?? null
  if (until && until < from) return null // 这一轮已经结束了
  const hardEnd = until ?? toStr(addDays(parseLocal(from), 400))
  const dates = expandRepeat(task.due, mode, until, from, hardEnd, task.repeatEvery)
  for (const d of dates) if (!skipped(d)) return d
  return null
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

/** 单个事件占用的时长（小时）
 *  没有时段的「截止型」事项不占时间，也就不会抬高当天的忙碌程度 */
export function eventHours(e: CalendarEvent): number {
  if (e.meta?.deadline) return 0
  if (!e.time || !e.endTime) return 0
  const [sh, sm] = e.time.split(':').map(Number)
  const [eh, em] = e.endTime.split(':').map(Number)
  return Math.max(0.5, (eh * 60 + (em || 0) - sh * 60 - (sm || 0)) / 60)
}

/** 这一天的「截止压力」：有未完成、且已进入截止前 3 天（或已逾期）的截止型事项时为 1 */
export function deadlinePressure(events: CalendarEvent[], today: string): number {
  for (const e of events) {
    if (!e.meta?.deadline) continue
    if (e.meta.status === 'done' || e.meta.status === 'archived') continue
    const [y, m, d] = e.date.split('-').map(Number)
    const due = new Date(y, m - 1, d)
    const [ty, tm, td] = today.split('-').map(Number)
    const now = new Date(ty, tm - 1, td)
    const daysLeft = Math.round((due.getTime() - now.getTime()) / 86400000)
    if (daysLeft <= 3) return 1
  }
  return 0
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
