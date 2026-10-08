import { ipcMain, dialog } from 'electron'
import { join, relative, isAbsolute } from 'path'
import {
  initDataStore,
  readJsonFile,
  writeJsonFile,
  readMarkdownFile,
  writeMarkdownFile,
  listFiles,
  exportData,
  deleteFile,
  type DataPaths
} from './dataStore'

let dataRoot = ''
let paths: DataPaths
const JSON_FILES: Record<string, string> = {}

export async function setupIpc(): Promise<void> {
  const ds = await initDataStore()
  dataRoot = ds.root
  paths = ds.paths
  JSON_FILES.settings = join(paths.config, 'settings.json')
  JSON_FILES.seasons = join(paths.config, 'seasons.json')
  JSON_FILES.achievements = join(paths.config, 'achievements.json')
  JSON_FILES.tasks = join(paths.tasks, 'tasks.json')
  JSON_FILES.plans = join(paths.plans, 'plans.json')
  register()
}

function register(): void {
  ipcMain.handle('data:root', () => dataRoot)

  ipcMain.handle('data:readJson', (_e, key: string) => {
    const file = JSON_FILES[key]
    if (!file) return null
    return readJsonFile(file)
  })

  ipcMain.handle('data:writeJson', async (_e, key: string, data: unknown) => {
    const file = JSON_FILES[key]
    if (!file) return false
    await writeJsonFile(file, data)
    return true
  })

  ipcMain.handle('data:readMarkdown', (_e, rel: string) => {
    return readMarkdownFile(safeResolve(rel))
  })

  ipcMain.handle('data:writeMarkdown', async (_e, rel: string, content: string) => {
    await writeMarkdownFile(safeResolve(rel), content)
    return true
  })

  ipcMain.handle('data:list', (_e, relDir: string, ext?: string) => {
    return listFiles(safeResolve(relDir), ext)
  })

  ipcMain.handle('data:delete', async (_e, rel: string) => {
    await deleteFile(safeResolve(rel))
    return true
  })

  ipcMain.handle('data:export', async () => {
    const res = await dialog.showOpenDialog({
      title: '选择导出目标文件夹',
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || !res.filePaths[0]) return { canceled: true }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dest = join(res.filePaths[0], `LifeQuest-export-${stamp}`)
    await exportData(dataRoot, dest)
    return { canceled: false, dest }
  })
}

/** 防目录穿越：解析后的路径必须落在数据根目录内 */
function safeResolve(rel: string): string {
  const abs = join(dataRoot, rel)
  const back = relative(dataRoot, abs)
  if (back.startsWith('..') || isAbsolute(back)) {
    throw new Error('非法路径')
  }
  return abs
}
