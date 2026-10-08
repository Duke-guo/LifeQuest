import { app } from 'electron'
import { promises as fs, existsSync } from 'fs'
import { join, dirname, extname } from 'path'

const CURRENT_SCHEMA_VERSION = 1

export interface DataPaths {
  root: string
  config: string
  tasks: string
  journal: string
  notes: string
  plans: string
  archive: string
  assets: string
}

const FOLDERS = ['config', 'tasks', 'journal', 'notes', 'plans', 'archive', 'assets'] as const

// 版本迁移表：key = 迁移前的 schemaVersion，value = 迁到下一版本的函数
// 例：0 -> 1 时若将来有结构变化，在此登记
const migrations: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {}

export function defaultDataRoot(): string {
  // 便携版：数据放在便携 exe 同级目录
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return join(process.env.PORTABLE_EXECUTABLE_DIR, 'LifeQuest-Data')
  }
  // 打包安装版：数据放在 exe 同级目录；开发时：放在项目目录（D 盘工作区）
  const base = app.isPackaged ? dirname(app.getPath('exe')) : app.getAppPath()
  return join(base, 'LifeQuest-Data')
}

export function resolveDataRoot(): string {
  return process.env.LIFEQUEST_DATA_ROOT || defaultDataRoot()
}

export function getDataPaths(root: string): DataPaths {
  return {
    root,
    config: join(root, 'config'),
    tasks: join(root, 'tasks'),
    journal: join(root, 'journal'),
    notes: join(root, 'notes'),
    plans: join(root, 'plans'),
    archive: join(root, 'archive'),
    assets: join(root, 'assets')
  }
}

export interface DataStore {
  root: string
  paths: DataPaths
}

/** 初始化：创建目录结构 + 缺失时写入默认文件 */
export async function initDataStore(): Promise<DataStore> {
  const root = resolveDataRoot()
  const paths = getDataPaths(root)
  for (const f of FOLDERS) {
    await fs.mkdir(paths[f], { recursive: true })
  }
  await seedDefaults(paths)
  return { root, paths }
}

async function seedDefaults(paths: DataPaths): Promise<void> {
  const defaults: Array<[string, unknown]> = [
    [
      join(paths.config, 'settings.json'),
      {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        dataRoot: paths.root,
        theme: 'light',
        animations: { enabled: true },
        gamification: { enabled: true, level: 'light' },
        ai: { enabled: false, baseUrl: 'https://api.deepseek.com', apiKey: '', model: 'deepseek-chat' }
      }
    ],
    [join(paths.config, 'seasons.json'), { schemaVersion: CURRENT_SCHEMA_VERSION, seasons: [] }],
    [join(paths.config, 'achievements.json'), { schemaVersion: CURRENT_SCHEMA_VERSION, achievements: [] }],
    [join(paths.config, 'tags.json'), { schemaVersion: CURRENT_SCHEMA_VERSION, tags: [] }],
    [join(paths.config, 'links.json'), { schemaVersion: CURRENT_SCHEMA_VERSION, links: [] }],
    [join(paths.tasks, 'tasks.json'), { schemaVersion: CURRENT_SCHEMA_VERSION, tasks: [] }],
    [join(paths.plans, 'plans.json'), { schemaVersion: CURRENT_SCHEMA_VERSION, plans: [] }]
  ]
  for (const [filePath, data] of defaults) {
    if (!existsSync(filePath)) {
      await writeJsonFile(filePath, data)
    }
  }
}

/** 读取 JSON：不存在返回 null；版本过低则先备份再迁移 */
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  if (!existsSync(filePath)) return null
  const raw = await fs.readFile(filePath, 'utf-8')
  let data = JSON.parse(raw) as T
  data = (await migrateIfNeeded(filePath, data)) as T
  return data
}

async function migrateIfNeeded<T>(filePath: string, data: T): Promise<T> {
  const version = (data as { schemaVersion?: number } | null)?.schemaVersion ?? 0
  if (version >= CURRENT_SCHEMA_VERSION) return data
  await backupFile(filePath)
  let migrated: Record<string, unknown> = { ...(data as Record<string, unknown>) }
  for (let v = version; v < CURRENT_SCHEMA_VERSION; v++) {
    const migrate = migrations[v]
    if (migrate) migrated = migrate(migrated)
  }
  migrated = { ...migrated, schemaVersion: CURRENT_SCHEMA_VERSION }
  await writeJsonFile(filePath, migrated)
  return migrated as T
}

async function backupFile(filePath: string): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  await fs.copyFile(filePath, `${filePath}.${stamp}.bak`)
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export async function readMarkdownFile(filePath: string): Promise<string> {
  if (!existsSync(filePath)) return ''
  return fs.readFile(filePath, 'utf-8')
}

export async function writeMarkdownFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf-8')
}

/** 列出目录下文件（可按扩展名过滤），只返回文件名 */
export async function listFiles(dir: string, ext?: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && (!ext || e.name.endsWith(ext)))
    .map((e) => e.name)
}

/** 导出 = 复制整个数据文件夹到目标目录 */
export async function exportData(root: string, destDir: string): Promise<void> {
  await fs.cp(root, destDir, { recursive: true })
}

/** 删除文件（不存在则忽略） */
export async function deleteFile(filePath: string): Promise<void> {
  if (existsSync(filePath)) {
    await fs.rm(filePath, { force: true })
  }
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp'
}

/** 保存 base64 图片到 assets，返回文件名 */
export async function saveImageFile(assetsDir: string, filename: string, dataUrl: string): Promise<string> {
  await fs.mkdir(assetsDir, { recursive: true })
  const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '')
  await fs.writeFile(join(assetsDir, filename), Buffer.from(base64, 'base64'))
  return filename
}

/** 读取图片为 data URL，供渲染进程显示 */
export async function readImageFile(filePath: string): Promise<string> {
  if (!existsSync(filePath)) return ''
  const buf = await fs.readFile(filePath)
  const ext = extname(filePath).slice(1).toLowerCase()
  const mime = MIME[ext] ?? 'application/octet-stream'
  return `data:${mime};base64,${buf.toString('base64')}`
}
