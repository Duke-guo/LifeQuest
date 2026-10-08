import type {
  Settings,
  TasksFile,
  SeasonsFile,
  AchievementsFile,
  PlansFile,
  TagsFile,
  LinksFile
} from '../../../shared/types'

// 渲染进程的数据服务层：统一封装对主进程 IPC 的调用
export const dataApi = {
  getRoot: (): Promise<string> => window.api.dataRoot(),

  readSettings: async (): Promise<Settings | null> =>
    (await window.api.readJson('settings')) as Settings | null,
  writeSettings: (s: Settings): Promise<boolean> => window.api.writeJson('settings', s),

  readTasks: async (): Promise<TasksFile | null> => (await window.api.readJson('tasks')) as TasksFile | null,
  writeTasks: (t: TasksFile): Promise<boolean> => window.api.writeJson('tasks', t),

  readSeasons: async (): Promise<SeasonsFile | null> =>
    (await window.api.readJson('seasons')) as SeasonsFile | null,
  writeSeasons: (s: SeasonsFile): Promise<boolean> => window.api.writeJson('seasons', s),

  readAchievements: async (): Promise<AchievementsFile | null> =>
    (await window.api.readJson('achievements')) as AchievementsFile | null,
  writeAchievements: (a: AchievementsFile): Promise<boolean> => window.api.writeJson('achievements', a),

  readTags: async (): Promise<TagsFile | null> => (await window.api.readJson('tags')) as TagsFile | null,
  writeTags: (t: TagsFile): Promise<boolean> => window.api.writeJson('tags', t),

  readLinks: async (): Promise<LinksFile | null> => (await window.api.readJson('links')) as LinksFile | null,
  writeLinks: (l: LinksFile): Promise<boolean> => window.api.writeJson('links', l),

  readPlans: async (): Promise<PlansFile | null> => (await window.api.readJson('plans')) as PlansFile | null,
  writePlans: (p: PlansFile): Promise<boolean> => window.api.writeJson('plans', p),

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
