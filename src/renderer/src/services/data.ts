import type {
  Settings,
  TasksFile,
  SeasonsFile,
  AchievementsFile,
  PlansFile,
  TagsFile,
  LinksFile,
  SemesterFile,
  DayNotesFile,
  HistoryFile
} from '../../../shared/types'

/**
 * IPC 只接受可「结构化克隆」的普通对象。
 * Vue 的响应式对象是 Proxy，直接传入会导致 invoke 在发送前就抛错，
 * 因此所有写操作都先做一次深拷贝转成普通对象。
 */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

// 渲染进程的数据服务层：统一封装对主进程 IPC 的调用
export const dataApi = {
  getRoot: (): Promise<string> => window.api.dataRoot(),

  readSettings: async (): Promise<Settings | null> =>
    (await window.api.readJson('settings')) as Settings | null,
  writeSettings: (s: Settings): Promise<boolean> => window.api.writeJson('settings', plain(s)),

  readTasks: async (): Promise<TasksFile | null> => (await window.api.readJson('tasks')) as TasksFile | null,
  writeTasks: (t: TasksFile): Promise<boolean> => window.api.writeJson('tasks', plain(t)),

  readSeasons: async (): Promise<SeasonsFile | null> =>
    (await window.api.readJson('seasons')) as SeasonsFile | null,
  writeSeasons: (s: SeasonsFile): Promise<boolean> => window.api.writeJson('seasons', plain(s)),

  readAchievements: async (): Promise<AchievementsFile | null> =>
    (await window.api.readJson('achievements')) as AchievementsFile | null,
  writeAchievements: (a: AchievementsFile): Promise<boolean> => window.api.writeJson('achievements', plain(a)),

  readTags: async (): Promise<TagsFile | null> => (await window.api.readJson('tags')) as TagsFile | null,
  writeTags: (t: TagsFile): Promise<boolean> => window.api.writeJson('tags', plain(t)),

  readLinks: async (): Promise<LinksFile | null> => (await window.api.readJson('links')) as LinksFile | null,
  writeLinks: (l: LinksFile): Promise<boolean> => window.api.writeJson('links', plain(l)),

  readPlans: async (): Promise<PlansFile | null> => (await window.api.readJson('plans')) as PlansFile | null,
  writePlans: (p: PlansFile): Promise<boolean> => window.api.writeJson('plans', plain(p)),

  readSemester: async (): Promise<SemesterFile | null> =>
    (await window.api.readJson('semester')) as SemesterFile | null,
  writeSemester: (s: SemesterFile): Promise<boolean> => window.api.writeJson('semester', plain(s)),

  readDayNotes: async (): Promise<DayNotesFile | null> =>
    (await window.api.readJson('daynotes')) as DayNotesFile | null,
  writeDayNotes: (d: DayNotesFile): Promise<boolean> => window.api.writeJson('daynotes', plain(d)),

  readHistory: async (): Promise<HistoryFile | null> =>
    (await window.api.readJson('history')) as HistoryFile | null,
  writeHistory: (h: HistoryFile): Promise<boolean> => window.api.writeJson('history', plain(h)),

  readMarkdown: (rel: string): Promise<string> => window.api.readMarkdown(rel),
  writeMarkdown: (rel: string, content: string): Promise<boolean> =>
    window.api.writeMarkdown(rel, content),
  listFiles: (dir: string, ext?: string): Promise<string[]> => window.api.listFiles(dir, ext),
  deleteFile: (rel: string): Promise<boolean> => window.api.deleteFile(rel),

  saveImage: (dataUrl: string): Promise<string> => window.api.saveImage(dataUrl),
  readImage: (filename: string): Promise<string> => window.api.readImage(filename),
  deleteImage: (filename: string): Promise<boolean> => window.api.deleteImage(filename),

  aiImageToTasks: (
    dataUrl: string
  ): Promise<{ ok: boolean; items?: unknown[]; error?: string }> => window.api.aiImageToTasks(dataUrl),

  export: (): Promise<{ canceled: boolean; dest?: string }> => window.api.exportData()
}
