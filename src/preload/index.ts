import { contextBridge, ipcRenderer } from 'electron'
import type { UpdateCheckResult } from '../shared/types'

// 白名单 API：渲染进程唯一能触达主进程的入口
const api = {
  ping: (): Promise<string> => ipcRenderer.invoke('ping'),
  /** 当前应用版本号（来自 package.json） */
  version: (): Promise<string> => ipcRenderer.invoke('app:version'),
  /** 查 GitHub Releases 最新版本（手动触发） */
  checkUpdate: (): Promise<UpdateCheckResult> => ipcRenderer.invoke('update:check'),
  /** 读取后台已查到的更新状态（可能为 null，表示还没查到） */
  updateState: (): Promise<UpdateCheckResult | null> => ipcRenderer.invoke('update:state'),
  /** 订阅后台检查完成的通知 */
  onUpdateChanged: (cb: (state: UpdateCheckResult) => void): void => {
    ipcRenderer.on('update:changed', (_e, state: UpdateCheckResult) => cb(state))
  },
  /** 用系统浏览器打开外链 */
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('app:openExternal', url),
  /** 当前平台：'win32' | 'darwin' | 'linux'（界面按平台调整标题栏/快捷键提示） */
  platform: process.platform,
  dataRoot: (): Promise<string> => ipcRenderer.invoke('data:root'),
  readJson: (key: string): Promise<unknown> => ipcRenderer.invoke('data:readJson', key),
  writeJson: (key: string, data: unknown): Promise<boolean> => ipcRenderer.invoke('data:writeJson', key, data),
  readMarkdown: (rel: string): Promise<string> => ipcRenderer.invoke('data:readMarkdown', rel),
  writeMarkdown: (rel: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('data:writeMarkdown', rel, content),
  listFiles: (dir: string, ext?: string): Promise<string[]> => ipcRenderer.invoke('data:list', dir, ext),
  deleteFile: (rel: string): Promise<boolean> => ipcRenderer.invoke('data:delete', rel),
  exportData: (): Promise<{ canceled: boolean; dest?: string }> => ipcRenderer.invoke('data:export'),

  // 图片
  saveImage: (dataUrl: string): Promise<string> => ipcRenderer.invoke('data:saveImage', dataUrl),
  readImage: (filename: string): Promise<string> => ipcRenderer.invoke('data:readImage', filename),
  deleteImage: (filename: string): Promise<boolean> => ipcRenderer.invoke('data:deleteImage', filename),

  // 笔记附件
  attachFile: (): Promise<{ canceled: boolean; name?: string; file?: string }> =>
    ipcRenderer.invoke('data:attachFile'),
  openAttachment: (filename: string): Promise<boolean> => ipcRenderer.invoke('data:openAttachment', filename),
  deleteAttachment: (filename: string): Promise<boolean> =>
    ipcRenderer.invoke('data:deleteAttachment', filename),

  // AI 识图
  aiImageToTasks: (
    dataUrl: string
  ): Promise<{ ok: boolean; items?: unknown[]; error?: string }> =>
    ipcRenderer.invoke('ai:imageToTasks', dataUrl),

  // 自绘标题栏的窗口控制
  win: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: (): Promise<boolean> => ipcRenderer.invoke('window:toggleMaximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    onMaximizedChange: (cb: (v: boolean) => void): void => {
      ipcRenderer.on('window:maximized', (_e, v: boolean) => cb(v))
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
