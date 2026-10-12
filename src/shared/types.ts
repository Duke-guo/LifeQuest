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
/** 重复方式；以 due 为首次日期，按 repeatUntil 截止
 *  every-n = 每 N 天一次（N 存在 repeatEvery 里） */
export type RepeatMode = 'none' | 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'every-n'

export type TaskType = 'main' | 'side' | 'daily'
export type TaskStatus = 'todo' | 'doing' | 'done' | 'archived'
/** task = 粗略任务（可无时间）；schedule = 日程（有具体时间段） */
export type TaskKind = 'task' | 'schedule'

/** 不规律的一次：单独指定日期（可覆盖时间段） */
export interface TaskOccurrence {
  date: string
  startTime?: string | null
  endTime?: string | null
}

/** 一条重复链：一个任务可以有多条（比如高数一周两节，周二一节、周四一节） */
export interface TaskChain {
  /** 这条链的起点日期，决定落在星期几 */
  due: string
  repeat: RepeatMode
  /** repeat = 'every-n' 时：隔几天一次 */
  repeatEvery?: number | null
  repeatUntil?: string | null
  startTime?: string | null
  endTime?: string | null
  location?: string | null
  /** 这条链单独排掉的日期（停课 / 调休） */
  skipOccurrences?: string[]
}

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
  /** 只有截止、没有时段时，可给个具体时刻（HH:mm）；空 = 当天 24:00 */
  dueTime?: string | null
  /** 日程时间段 HH:mm（仅 kind=schedule） */
  startTime: string | null
  endTime: string | null
  /** 地名/教室 */
  location: string | null
  /** 提前多少分钟提醒（仅 kind=schedule） */
  remindMinutes: number | null
  /** 重复方式：见 RepeatMode；空/ none 表示单次 */
  repeat?: RepeatMode
  /** repeat = 'every-n' 时：隔几天一次（1 = 每天） */
  repeatEvery?: number | null
  /** 重复截止日期（含当天）；空表示不限 */
  repeatUntil?: string | null
  /** 手动排掉的某几次（放假 / 停课 / 老师调课）：这些日期不算发生，也不计入进度 */
  skipOccurrences?: string[]
  /** 不规律的重复：逐次列出日期（可与 repeat 并存，各自都会排进日历） */
  occurrences?: TaskOccurrence[]
  /** 额外的重复链：一个任务多条（一周两节课就是两条链） */
  chains?: TaskChain[]
  tags: string[]
  tagIds: string[]
  /** 关联的笔记 id（日程 ↔ 笔记） */
  linkedNoteIds: string[]
  /** 是否在首页「重要提醒」里展示（像考试这类重要事项） */
  showOnHome?: boolean
  /** 重复任务「哪几次已完成」：存具体日期，勾一次加一天，不影响后面的次数 */
  doneDates?: string[]
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

/** 旧版成就定义（保留兼容，不再用于展示） */
export interface Achievement {
  id: string
  name: string
  category: string
  condition: AchievementCondition
  title: string
  reward: { xp: number }
}

/** 自定义成就：用户自己定的目标，统计某个维度 */
export type AchievementMetric = 'tasks' | 'daily' | 'notes' | 'journals'

export interface CustomAchievement {
  id: string
  name: string
  metric: AchievementMetric
  target: number
  /** 关联的赛季 id：选了就只统计那个赛季区间内的数据；空 = 全局 */
  seasonId?: string | null
}

export interface AchievementsFile {
  schemaVersion: number
  /** 旧字段，保留兼容（可忽略） */
  achievements: Achievement[]
  /** 里程碑首次点亮的日期：id -> YYYY-MM-DD */
  unlocked: Record<string, string>
  /** 用户自定义成就 */
  custom: CustomAchievement[]
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

// ===================== 学期 / 校历（属于「计划」范畴） =====================
export interface SemesterHoliday {
  id: string
  name: string
  start: string
  end: string
  /** 是否停课（课表类重复任务在这些日期不出现） */
  noClass: boolean
}

export interface Semester {
  schemaVersion: number
  name: string
  /** 开学日（第 1 周周一） */
  start: string
  /** 教学最后一天（之后进入复习/考试周） */
  teachingEnd: string
  /** 期末考试区间 */
  examStart: string
  examEnd: string
  holidays: SemesterHoliday[]
}

export type SemesterFile = Semester

// ===================== 每日标签（用户自己写的忙碌程度 / 备注） =====================
/** 某天的性质；auto/未设置时按校历推算 */
export type DayPhaseOverride = 'auto' | 'class' | 'weekend' | 'holiday' | 'exam' | 'none' | 'custom'

export interface DayNote {
  date: string
  /** 用户自定义的忙碌标签；为空则用算法算出的默认值 */
  busy?: string
  /** 用户手动指定的当天性质（上课/周末/放假/考试/空白）；auto 表示按校历 */
  phase?: DayPhaseOverride
  /** phase = custom 时，这一天自己想叫什么就叫什么 */
  phaseLabel?: string
  /** 备注 */
  note?: string
}

export interface DayNotesFile {
  schemaVersion: number
  days: DayNote[]
}

// ===================== 添加/删除历史（误删可一键找回） =====================
export interface HistoryEntry {
  id: string
  /** ISO 时间戳 */
  at: string
  action: 'add' | 'delete'
  /** 当时的完整快照 */
  task: Task
}

export interface HistoryFile {
  schemaVersion: number
  entries: HistoryEntry[]
}

// ===================== 示例数据（首次体验模板） =====================
/** 记录「示例数据」到底创建了哪些东西，方便一键清空且不误伤真实数据 */
export interface DemoFile {
  schemaVersion: number
  loaded: boolean
  seasonIds: string[]
  taskIds: string[]
  planIds: string[]
  noteFiles: string[]
  journalDates: string[]
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
    /** 只有截止时间、没有时段的「截止型」事件，日历上画成插入旗标 */
    deadline?: boolean
  }
}

// ===================== 更新检查 =====================
export type UpdateCheckResult =
  | { ok: true; current: string; latest: string; hasUpdate: boolean; url: string; notes: string }
  | { ok: false; error: string }
