import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { setupIpc } from './ipc'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    title: 'LifeQuest',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 开发模式下加载 dev server，否则加载打包产物
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 调试截图（仅当设置环境变量时启用，用于无头验证 UI）
  if (process.env.LIFEQUEST_SCREENSHOT) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          if (process.env.LIFEQUEST_VIEW) {
            const view = process.env.LIFEQUEST_VIEW
            const clickResult = await mainWindow.webContents.executeJavaScript(
              `(() => {
                const btns = [...document.querySelectorAll('nav button')]
                const target = btns.find((b) => b.textContent.includes('${view}'))
                if (target) { target.click(); return 'clicked' }
                return 'not found'
              })()`
            )
            console.log('navigate:', view, '->', clickResult)
            await new Promise((r) => setTimeout(r, 400))
          }
          if (process.env.LIFEQUEST_CLICK) {
            const label = process.env.LIFEQUEST_CLICK
            const clickResult = await mainWindow.webContents.executeJavaScript(
              `(() => {
                const btns = [...document.querySelectorAll('button')]
                const target = btns.find((b) => b.textContent.includes('${label}'))
                if (target) { target.click(); return 'clicked' }
                return 'not found'
              })()`
            )
            console.log('click:', label, '->', clickResult)
            await new Promise((r) => setTimeout(r, 600))
          }
          const image = await mainWindow.webContents.capturePage()
          await writeFile(process.env.LIFEQUEST_SCREENSHOT as string, image.toPNG())
          console.log('screenshot saved:', process.env.LIFEQUEST_SCREENSHOT)
          const text = await mainWindow.webContents.executeJavaScript(
            `(() => {
              let out = '[theme=' + document.documentElement.dataset.theme + ' bg=' + getComputedStyle(document.body).backgroundColor + ' radial=' + document.querySelectorAll('.radial-item').length + ' avatar=' + document.querySelectorAll('.avatar').length + ']\\n'
              out += document.body.innerText
              const tas = [...document.querySelectorAll('textarea')].map((t) => t.value).filter((v) => v)
              const ins = [...document.querySelectorAll('input')].map((i) => i.value).filter((v) => v)
              if (tas.length) out += '\\n--- TEXTAREA ---\\n' + tas.join('\\n')
              if (ins.length) out += '\\n--- INPUT ---\\n' + ins.join(' | ')
              return out
            })()`
          )
          console.log('--- PAGE TEXT ---')
          console.log(text)
          console.log('--- END PAGE TEXT ---')
        } catch (e) {
          console.error('screenshot failed', e)
        }
        app.quit()
      }, 1200)
    })
  }
}

// 骨架自检：渲染进程调用 ping，主进程回 pong，验证 IPC 桥接
ipcMain.handle('ping', () => 'pong')

app.whenReady().then(async () => {
  await setupIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
