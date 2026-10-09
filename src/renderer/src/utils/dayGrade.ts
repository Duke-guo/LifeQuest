import type { CalendarEvent, Mood, Weather } from '../../../shared/types'

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D'

export interface DayGrade {
  grade: Grade
  score: number
}

/** 任务完成度权重：任务本身 0.6，日记 0.4（日记比重高，是「有没有认真过这一天」的信号） */
const W_TASK = 0.6
const W_JOURNAL = 0.4

/**
 * 给一天打个「等级评价」：
 *  - 任务完成度：只算真正的待办（kind=task），按重要度加权；没有待办就记满分
 *    （课程这种日程不参与扣分，否则天天都是 D）
 *  - 日记：写了正文 = 1，只有天气/心情 = 0.4，没写 = 0
 * 既没安排也没日记的日子不评级（返回 null），不给人添堵。
 */
export function computeDayGrade(
  events: CalendarEvent[],
  journal?: { hasContent: boolean; mood?: Mood | null; weather?: Weather | null } | null
): DayGrade | null {
  const items = events.filter((e) => e.meta?.status !== 'archived')
  const tasks = items.filter((e) => e.kind === 'task')

  const totalW = tasks.reduce((s, e) => s + (e.meta?.importance ?? 3), 0)
  const doneW = tasks
    .filter((e) => e.meta?.status === 'done')
    .reduce((s, e) => s + (e.meta?.importance ?? 3), 0)
  const taskRatio = totalW > 0 ? doneW / totalW : 1

  const journalRatio = journal ? (journal.hasContent ? 1 : journal.mood || journal.weather ? 0.4 : 0) : 0

  const hasSignal = items.length > 0 || journalRatio > 0
  if (!hasSignal) return null

  const score = W_TASK * taskRatio + W_JOURNAL * journalRatio
  const grade: Grade =
    score >= 0.9 ? 'S' : score >= 0.72 ? 'A' : score >= 0.5 ? 'B' : score >= 0.3 ? 'C' : 'D'
  return { grade, score }
}

export const GRADE_TITLE: Record<Grade, string> = {
  S: '全部完成且有日记',
  A: '完成得很好',
  B: '基本完成，日记可以补一篇',
  C: '有不少没完成',
  D: '几乎没动'
}
