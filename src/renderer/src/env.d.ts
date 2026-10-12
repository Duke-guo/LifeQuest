/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface Window {
  api: {
    ping: () => Promise<string>
    /** 'win32' | 'darwin' | 'linux' */
    platform: string
    dataRoot: () => Promise<string>
    readJson: (key: string) => Promise<unknown>
    writeJson: (key: string, data: unknown) => Promise<boolean>
    readMarkdown: (rel: string) => Promise<string>
    writeMarkdown: (rel: string, content: string) => Promise<boolean>
    listFiles: (dir: string, ext?: string) => Promise<string[]>
    deleteFile: (rel: string) => Promise<boolean>
    exportData: () => Promise<{ canceled: boolean; dest?: string }>
    saveImage: (dataUrl: string) => Promise<string>
    readImage: (filename: string) => Promise<string>
    deleteImage: (filename: string) => Promise<boolean>
    attachFile: () => Promise<{ canceled: boolean; name?: string; file?: string }>
    openAttachment: (filename: string) => Promise<boolean>
    deleteAttachment: (filename: string) => Promise<boolean>
    aiImageToTasks: (
      dataUrl: string
    ) => Promise<{ ok: boolean; items?: unknown[]; error?: string }>
    win: {
      minimize: () => Promise<void>
      toggleMaximize: () => Promise<boolean>
      close: () => Promise<void>
      isMaximized: () => Promise<boolean>
      onMaximizedChange: (cb: (v: boolean) => void) => void
    }
  }
}
