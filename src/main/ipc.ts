import { ipcMain, dialog } from 'electron'
import { join, relative, isAbsolute } from 'path'
import { request as httpsRequest } from 'https'
import { request as httpRequest } from 'http'
import {
  initDataStore,
  readJsonFile,
  writeJsonFile,
  readMarkdownFile,
  writeMarkdownFile,
  listFiles,
  exportData,
  deleteFile,
  saveImageFile,
  readImageFile,
  type DataPaths
} from './dataStore'
import type { Settings } from '../shared/types'

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
  JSON_FILES.tags = join(paths.config, 'tags.json')
  JSON_FILES.links = join(paths.config, 'links.json')
  JSON_FILES.tasks = join(paths.tasks, 'tasks.json')
  JSON_FILES.plans = join(paths.plans, 'plans.json')
  register()
}

const AI_PROMPT = `你是一个日程识别助手。请阅读这张图片（可能是课表、通知、日程截图、手写便签、海报等），提取其中所有事项，只输出 JSON 数组，不要输出任何解释文字。
每个元素格式：
{"title":"事项标题","weekday":1-7 或 null,"date":"YYYY-MM-DD 或 null","startTime":"HH:mm 或 null","endTime":"HH:mm 或 null","location":"地点或 null","importance":3}
说明：
- weekday 表示星期几，1=周一 … 7=周日。课表类图片请务必填 weekday。
- date 只在图片里出现具体日期时才填，否则填 null。
- importance 取 1-5 的整数。无法确定的字段填 null。`

/** 单次 POST 尝试（用 Node 原生 https，走主进程自己的 socket） */
function postJsonOnce(
  url: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const lib = u.protocol === 'https:' ? httpsRequest : httpRequest
    let done = false
    const finish = (fn: () => void): void => {
      if (done) return
      done = true
      fn()
    }
    const req = lib(
      {
        method: 'POST',
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Accept-Encoding': 'identity',
          Connection: 'close',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        const chunks: Buffer[] = []
        const done2 = (): void =>
          finish(() =>
            resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') })
          )
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', done2)
        res.on('close', done2)
        res.on('error', (e) => finish(() => reject(e)))
      }
    )
    req.setTimeout(timeoutMs, () => {
      finish(() => reject(new Error(`请求超时（${timeoutMs}ms）`)))
      req.destroy()
    })
    req.on('error', (e) => {
      if ((e as NodeJS.ErrnoException).code === 'ECONNRESET' && !done) {
        finish(() => reject(new Error('连接被重置')))
        return
      }
      finish(() => reject(e))
    })
    req.write(body)
    req.end()
  })
}

/** 带重试的 POST：网络偶发只回响应头不回响应体，重试可显著提高成功率 */
async function postJson(
  url: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs = 15000,
  attempts = 3
): Promise<{ status: number; text: string }> {
  let lastError: Error | null = null
  for (let i = 1; i <= attempts; i++) {
    try {
      const r = await postJsonOnce(url, headers, body, timeoutMs)
      if (r.text.length > 0) return r
      lastError = new Error('响应体为空')
      console.log(`[postJson] 第 ${i} 次响应体为空，重试…`)
    } catch (e) {
      lastError = e as Error
      console.log(`[postJson] 第 ${i} 次失败：${(e as Error).message}`)
    }
  }
  throw lastError ?? new Error('请求失败')
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
    try {
      await writeJsonFile(file, data)
      return true
    } catch (err) {
      console.error('[data:writeJson] 写入失败:', key, err)
      return false
    }
  })

  ipcMain.handle('data:readMarkdown', (_e, rel: string) => readMarkdownFile(safeResolve(rel)))

  ipcMain.handle('data:writeMarkdown', async (_e, rel: string, content: string) => {
    await writeMarkdownFile(safeResolve(rel), content)
    return true
  })

  ipcMain.handle('data:list', (_e, relDir: string, ext?: string) => listFiles(safeResolve(relDir), ext))

  ipcMain.handle('data:delete', async (_e, rel: string) => {
    await deleteFile(safeResolve(rel))
    return true
  })

  // ---- 图片（B11）----
  ipcMain.handle('data:saveImage', async (_e, dataUrl: string) => {
    const m = /^data:image\/(\w+);base64,/.exec(dataUrl)
    const raw = m ? m[1].toLowerCase() : 'png'
    const ext = raw === 'jpeg' ? 'jpg' : raw
    const filename = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    await saveImageFile(paths.assets, filename, dataUrl)
    return filename
  })

  ipcMain.handle('data:readImage', (_e, filename: string) => readImageFile(join(paths.assets, filename)))

  ipcMain.handle('data:deleteImage', async (_e, filename: string) => {
    await deleteFile(join(paths.assets, filename))
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

  // ---- AI 识图（B17）----
  ipcMain.handle('ai:imageToTasks', async (_e, dataUrl: string) => {
    const settings = await readJsonFile<Settings>(JSON_FILES.settings)
    const ai = settings?.ai
    if (!ai || !ai.enabled || !ai.apiKey) {
      return { ok: false, error: '尚未配置 AI：请到「设置 → AI 识图」填写 API Key 并启用。' }
    }
    try {
      const started = Date.now()
      const reqBody = JSON.stringify({
        model: ai.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: AI_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ]
      })
      const { status, text: rawText } = await postJson(
        `${ai.baseUrl.replace(/\/+$/, '')}/chat/completions`,
        {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ai.apiKey}`
        },
        reqBody
      )
      console.log('[ai] HTTP', status, `${((Date.now() - started) / 1000).toFixed(1)}s`)
      if (status < 200 || status >= 300) {
        return { ok: false, error: `接口返回 ${status}：${rawText.slice(0, 300)}` }
      }
      const json = JSON.parse(rawText) as {
        choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>
      }
      const msg = json.choices?.[0]?.message
      const content = msg?.content ?? ''
      const match = content.match(/\[[\s\S]*\]/)
      if (!match) {
        console.log('[ai] 未匹配到 JSON 数组，原始返回:', rawText.slice(0, 400))
        return { ok: false, error: `未能从返回中解析出任务列表：${content.slice(0, 200)}` }
      }
      const items = JSON.parse(match[0])
      console.log('[ai] 解析出', items.length, '条')
      return { ok: true, items }
    } catch (e) {
      console.error('[ai] 异常:', e)
      return { ok: false, error: `请求失败：${(e as Error).message}` }
    }
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
