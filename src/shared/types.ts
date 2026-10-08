// 共享类型定义：与 docs/架构与数据设计.md 的数据契约一一对应

export type TaskType = 'main' | 'side' | 'daily'
export type TaskStatus = 'todo' | 'doing' | 'done' | 'archived'

export interface Task {
  id: string
  type: TaskType
  title: string
  description: string
  /** 重要程度 1-5，映射到视觉醒目度 */
  importance: number
  status: TaskStatus
  seasonId: string | null
  parentId: string | null
  /** 截止日期 YYYY-MM-DD */
  due: string | null
  tags: string[]
  createdAt: string
  completedAt: string | null
}

export interface TasksFile {
  schemaVersion: number
  tasks: Task[]
}

export type SeasonType = 'main' | 'side'
export type SeasonStatus = 'planned' | 'active' | 'archived'

export interface Season {
  id: string
  name: string
  type: SeasonType
  start: string
  end: string
  status: SeasonStatus
  categories: string[]
}

export interface SeasonsFile {
  schemaVersion: number
  seasons: Season[]
}

export interface AchievementCondition {
  type: 'checkin_count' | 'task_count' | 'note_count' | 'custom'
  value: number
}

export interface Achievement {
  id: string
  name: string
  category: string
  condition: AchievementCondition
  title: string
  reward: { xp: number }
}

export interface AchievementsFile {
  schemaVersion: number
  achievements: Achievement[]
}

export type GamificationLevel = 'light' | 'medium' | 'heavy'

export interface Settings {
  schemaVersion: number
  dataRoot: string
  theme: string
  animations: { enabled: boolean }
  gamification: { enabled: boolean; level: GamificationLevel }
}

export interface NoteMeta {
  date: string
  theme: string[]
  rating: number
  tags: string[]
}

export interface JournalMeta {
  date: string
  mood: number
  tags: string[]
}

export interface Plan {
  schemaVersion: number
  id: string
  title: string
  start: string
  end: string
  seasonId: string | null
  notes: string
  taskIds: string[]
}

export interface PlansFile {
  schemaVersion: number
  plans: Plan[]
}
