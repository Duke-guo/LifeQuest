import { contextBridge, ipcRenderer } from 'electron'

// 白名单 API：渲染进程唯一能触达主进程的入口
const api = {
  ping: (): Promise<string> => ipcRenderer.invoke('ping'),
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
