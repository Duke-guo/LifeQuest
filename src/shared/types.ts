// 共享类型定义：与 docs/架构与数据设计.md 的数据契约一一对应

// ===================== 标签系统（B4） =====================
export type TagKind = 'subject' | 'theme' | 'custom'

export interface Tag {
  id: string
  name: string
  color: string
  kind: TagKind
}

export interface TagsFile {
  schemaVersion: number
  tags: Tag[]
}

// ===================== 关联系统（B4 / B12） =====================
export type EntityKind = 'task' | 'note' | 'plan' | 'journal' | 'season'

export interface EntityRef {
  kind: EntityKind
  id: string
}

export interface Link {
  id: string
  from: EntityRef
  to: EntityRef
  label?: string
}

export interface LinksFile {
  schemaVersion: number
  links: Link[]
}

// ===================== 任务 / 日程（B14） =====================
/** 重复方式；以 due 为首次日期，按 repeatUntil 截止 */
export type RepeatMode = 'none' | 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly'

export type TaskType = 'main' | 'side' | 'daily'
export type TaskStatus = 'todo' | 'doing' | 'done' | 'archived'
/** task = 粗略任务（可无时间）；schedule = 日程（有具体时间段） */
export type TaskKind = 'task' | 'schedule'

export interface Task {
  id: string
  kind: TaskKind
  type: TaskType
  title: string
  description: string
  /** 重要程度 1-5，映射到视觉醒目度 */
  importance: number
  status: TaskStatus
  seasonId: string | null
  parentId: string | null
  /** 截止 / 发生日期 YYYY-MM-DD */
  due: string | null
  /** 日程时间段 HH:mm（仅 kind=schedule） */
  startTime: string | null
  endTime: string | null
  /** 地名/教室 */
  location: string | null
  /** 提前多少分钟提醒（仅 kind=schedule） */
  remindMinutes: number | null
  /** 重复方式：见 RepeatMode；空/ none 表示单次 */
  repeat?: RepeatMode
  /** 重复截止日期（含当天）；空表示不限 */
  repeatUntil?: string | null
  tags: string[]
  tagIds: string[]
  /** 关联的笔记 id（日程 ↔ 笔记） */
  linkedNoteIds: string[]
  createdAt: string
  completedAt: string | null
}

export interface TasksFile {
  schemaVersion: number
  tasks: Task[]
}

// ===================== 赛季 =====================
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
  /** 该赛季在地图上的锚点（用于主线/支线可视化） */
  color?: string
}

export interface SeasonsFile {
  schemaVersion: number
  seasons: Season[]
}

// ===================== 成就 =====================
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

// ===================== 设置 =====================
export type GamificationLevel = 'light' | 'medium' | 'heavy'

export interface Settings {
  schemaVersion: number
  dataRoot: string
  theme: string
  animations: { enabled: boolean }
  gamification: { enabled: boolean; level: GamificationLevel }
  ai?: {
    enabled: boolean
    baseUrl: string
    apiKey: string
    model: string
  }
}

// ===================== 笔记（B10 / B11 / B12） =====================
export interface Note {
  id: string
  title: string
  /** 分类（如：数学、英语） */
  category: string
  date: string
  theme: string[]
  rating: number
  tags: string[]
  tagIds: string[]
  /** 图片文件名（存于 assets/） */
  images: string[]
  /** 关联实体（用于知识地图） */
  links: EntityRef[]
  content: string
}

// ===================== 日记（B8 / B9） =====================
export type Weather = 'sunny' | 'cloudy' | 'rain' | 'snow' | 'wind' | 'fog'
export type Mood = 'great' | 'good' | 'ok' | 'low' | 'bad'

export interface JournalMeta {
  date: string
  weather: Weather | null
  mood: Mood | null
  tags: string[]
  prompts: string[]
}

// ===================== 活动计划（B13） =====================
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

// ===================== 日历事件（B6 / B7 / B9 / B13） =====================
export type CalendarEventKind = 'task' | 'schedule' | 'plan' | 'journal'

export interface CalendarEvent {
  id: string
  date: string
  kind: CalendarEventKind
  title: string
  time?: string
  endTime?: string
  color?: string
  refId: string
  meta?: {
    importance?: number
    status?: TaskStatus
    weather?: Weather | null
    mood?: Mood | null
    tags?: string[]
    location?: string | null
  }
}
