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

/** 从 startDir 起向上找已存在的 LifeQuest-Data（最多 4 层） */
function findExistingRoot(startDir: string): string | null {
  let dir = startDir
  for (let i = 0; i < 4; i++) {
    const candidate = join(dir, 'LifeQuest-Data')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

export function defaultDataRoot(): string {
  // 便携版（Windows portable）：数据放在便携 exe 同级目录
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return join(process.env.PORTABLE_EXECUTABLE_DIR, 'LifeQuest-Data')
  }
  // Linux AppImage：程序跑在只读的挂载点里，要按 AppImage 文件本身的位置放数据
  if (process.env.APPIMAGE) {
    const dir = dirname(process.env.APPIMAGE)
    return findExistingRoot(dir) ?? join(dir, 'LifeQuest-Data')
  }
  // 从程序所在目录向上找已存在的 LifeQuest-Data：
  // 这样把程序放在工作区子目录（如 app/）时，数据仍落在工作区根目录；
  // 开发时（electron out/main/index.js）也不会另开一份 out/main/LifeQuest-Data
  const startDir = app.isPackaged ? dirname(app.getPath('exe')) : app.getAppPath()
  // macOS：exe 在 .app 包内部，不能往包里写；先在 .app 附近找（方便绿色版放在一起），
  // 找不到就用「文稿」目录，用户一眼能看到自己的数据
  if (app.isPackaged && process.platform === 'darwin') {
    const near = findExistingRoot(startDir)
    if (near) return near
    return join(app.getPath('documents'), 'LifeQuest-Data')
  }
  return findExistingRoot(startDir) ?? join(startDir, 'LifeQuest-Data')
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
    [join(paths.config, 'daynotes.json'), { schemaVersion: CURRENT_SCHEMA_VERSION, days: [] }],
    [join(paths.config, 'history.json'), { schemaVersion: CURRENT_SCHEMA_VERSION, entries: [] }],
    [
      join(paths.config, 'semester.json'),
      {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        name: '2026 秋季学期',
        start: '2026-09-07',
        teachingEnd: '2026-12-27',
        examStart: '2026-12-28',
        examEnd: '2027-01-10',
        holidays: [
          { id: 'h-1', name: '中秋节', start: '2026-09-25', end: '2026-09-25', noClass: true },
          { id: 'h-2', name: '国庆节', start: '2026-10-01', end: '2026-10-07', noClass: true },
          { id: 'h-3', name: '元旦', start: '2027-01-01', end: '2027-01-01', noClass: true }
        ]
      }
    ],
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

/** 把一个外部文件复制进 assets（附件），返回存储文件名；用原名 + 时间戳避免重名 */
export async function copyAttachment(assetsDir: string, srcPath: string): Promise<string> {
  await fs.mkdir(assetsDir, { recursive: true })
  const fileName = srcPath.split(/[\\/]/).pop() || 'file'
  const ext = extname(fileName)
  const base = ext ? fileName.slice(0, -ext.length) : fileName
  const safe = base.replace(/[^\w\u4e00-\u9fa5.-]/g, '_').slice(0, 40)
  const filename = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}${ext}`
  await fs.copyFile(srcPath, join(assetsDir, filename))
  return filename
}
