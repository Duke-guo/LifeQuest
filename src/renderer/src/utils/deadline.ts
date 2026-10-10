import type { Task } from '../../../shared/types'

/** 两个 YYYY-MM-DD 之间相差几天（to - from） */
export function diffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const a = new Date(fy, fm - 1, fd)
  const b = new Date(ty, tm - 1, td)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

/** 是不是「截止型」任务：有截止日期、不是课表里的日程 */
export function isDeadline(t: Task): boolean {
  return t.kind !== 'schedule' && !!t.due && t.status !== 'archived'
}

/**
 * 距截止还剩几天：0 = 今天截止，正数 = 还剩几天，负数 = 已逾期几天。
 * 不是截止型任务、或已完成，返回 null。
 */
export function daysLeft(t: Task, today: string): number | null {
  if (!isDeadline(t) || t.status === 'done') return null
  return diffDays(today, t.due as string)
}

/**
 * 截止临近带来的重要度加成：
 * 今天截止 / 已逾期 +2，三天内 +1，再远不加。
 */
export function deadlineBump(t: Task, today: string): number {
  const d = daysLeft(t, today)
  if (d === null) return 0
  if (d <= 0) return 2
  if (d <= 3) return 1
  return 0
}

/** 显示用的重要度（不写回磁盘）：临近截止会自动抬高，封顶 5 星 */
export function effectiveImportance(t: Task, today: string): number {
  return Math.min(5, Math.max(1, (t.importance || 3) + deadlineBump(t, today)))
}

/** 0..1 的紧迫度：越接近截止越深，用于日历上的渐变 */
export function deadlineIntensity(t: Task, today: string): number {
  const d = daysLeft(t, today)
  if (d === null) return 0
  if (d <= 0) return 1
  if (d >= 14) return 0.12
  return Math.max(0.12, 1 - d / 14)
}

/** 截止提醒文案：「今天 23:59 截止」「还剩 3 天」「已逾期 2 天」 */
export function deadlineText(t: Task, today: string): string {
  if (!t.due) return ''
  if (t.status === 'done') return '已完成'
  const d = diffDays(today, t.due)
  const time = t.dueTime ? ` ${t.dueTime}` : ''
  if (d === 0) return `今天${time} 截止`
  if (d === 1) return `明天${time} 截止`
  if (d > 1) return `还剩 ${d} 天`
  return `已逾期 ${-d} 天`
}

/** 短标签：列表里用的小徽章 */
export function deadlineShort(t: Task, today: string): string {
  if (!t.due) return ''
  if (t.status === 'done') return '已完成'
  const d = diffDays(today, t.due)
  if (d === 0) return '今天截止'
  if (d === 1) return '明天截止'
  if (d > 1) return `剩 ${d} 天`
  return `逾期 ${-d} 天`
}

/** 紧迫档位：给徽章/线换个颜色 */
export function deadlineTier(t: Task, today: string): 'over' | 'today' | 'soon' | 'later' {
  const d = t.status === 'done' || !t.due ? 99 : diffDays(today, t.due)
  if (d < 0) return 'over'
  if (d === 0) return 'today'
  if (d <= 3) return 'soon'
  return 'later'
}

/**
 * 「还在盯着的」截止任务：未完成、截止日还没过太久，按截止日升序。
 * 任务列表里每天都要露出这些，直到截止——所以不按「今天是否发生」过滤。
 */
export function upcomingDeadlines(tasks: Task[], today: string, lookBack = 14, lookAhead = 60): Task[] {
  return tasks
    .filter((t) => isDeadline(t) && t.status !== 'done')
    .filter((t) => {
      const d = diffDays(today, t.due as string)
      return d <= lookAhead && d >= -lookBack
    })
    .sort((a, b) => (a.due as string).localeCompare(b.due as string) || (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99'))
}
