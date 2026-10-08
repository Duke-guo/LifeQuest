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
  exportData: (): Promise<{ canceled: boolean; dest?: string }> => ipcRenderer.invoke('data:export')
}

contextBridge.exposeInMainWorld('api', api)
