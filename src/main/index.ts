import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { writeFile, readFile } from 'fs/promises'
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

  // 调试：把渲染进程 console 转发到主进程 stdout
  if (process.env.LIFEQUEST_SCREENSHOT) {
    mainWindow.webContents.on('console-message', (event: unknown, ...rest: unknown[]) => {
      const ev = event as { message?: string }
      const legacy = typeof rest[1] === 'string' ? (rest[1] as string) : ''
      console.log('[renderer]', ev?.message ?? legacy)
    })
  }

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
          // 等待渲染进程挂载完成（首次启动可能因杀软扫描而较慢）
          for (let i = 0; i < 80; i++) {
            const ready = await mainWindow.webContents.executeJavaScript(
              `!!document.querySelector('.fab, .avatar')`
            )
            if (ready) break
            await new Promise((r) => setTimeout(r, 250))
          }
          if (process.env.LIFEQUEST_VIEW) {
            // 支持逗号分隔的多个视图，用于验证「切页 → 返回」链路
            for (const view of process.env.LIFEQUEST_VIEW.split(',')
              .map((s) => s.trim())
              .filter(Boolean)) {
              await mainWindow.webContents.executeJavaScript(`document.querySelector('.fab')?.click()`)
              await new Promise((r) => setTimeout(r, 700))
              const clickResult = await mainWindow.webContents.executeJavaScript(
                `(async () => {
                const view = ${JSON.stringify(view)}
                const core = document.querySelector('.core')
                if (core && (core.textContent || '').includes(view)) { core.click(); return 'core' }
                const ring = [...document.querySelectorAll('.ring-item')].find((b) => (b.title || '').includes(view))
                if (!ring) return 'not found'
                ring.click()
                await new Promise((r) => setTimeout(r, 150))
                document.querySelector('.core')?.click()
                return 'ring->core'
              })()`
              )
              console.log('navigate:', view, '->', clickResult)
              await new Promise((r) => setTimeout(r, 900))
            }
          }
          if (process.env.LIFEQUEST_CLICK) {
            const labels = process.env.LIFEQUEST_CLICK.split(',').map((s) => s.trim()).filter(Boolean)
            for (const label of labels) {
              if (label.startsWith('@file:')) {
                const sel = JSON.stringify(label.slice(6))
                if (!process.env.LIFEQUEST_IMAGE) continue
                const buf = await readFile(process.env.LIFEQUEST_IMAGE)
                const b64 = buf.toString('base64')
                const r = await mainWindow.webContents.executeJavaScript(
                  `(async () => {
                    const b64 = ${JSON.stringify(b64)}
                    const bin = atob(b64)
                    const arr = new Uint8Array(bin.length)
                    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
                    const file = new File([arr], 'img.png', { type: 'image/png' })
                    const dt = new DataTransfer()
                    dt.items.add(file)
                    const inp = document.querySelector(${sel})
                    if (!inp) return 'no input'
                    inp.files = dt.files
                    inp.dispatchEvent(new Event('change', { bubbles: true }))
                    return 'file set'
                  })()`
                )
                console.log('inject file ->', r)
                await new Promise((res) => setTimeout(res, 1500))
                continue
              }
              if (label.startsWith('@day:')) {
                const n = JSON.stringify(label.slice(5))
                const r = await mainWindow.webContents.executeJavaScript(
                  `(() => {
                    const cells = [...document.querySelectorAll('.cell')]
                    const target = cells.find((c) => (c.querySelector('.day')?.textContent || '').trim() === ${n})
                    if (!target) return 'day not found'
                    target.click()
                    return 'clicked day ' + ${n}
                  })()`
                )
                console.log('click day ->', r)
                await new Promise((res) => setTimeout(res, 1200))
                continue
              }
              if (label.startsWith('@wait:')) {
                const ms = Number(label.slice(6)) || 1000
                await new Promise((res) => setTimeout(res, ms))
                continue
              }
              if (label === '@image') {
                if (!process.env.LIFEQUEST_IMAGE) continue
                const buf = await readFile(process.env.LIFEQUEST_IMAGE)
                const b64 = buf.toString('base64')
                const r = await mainWindow.webContents.executeJavaScript(
                  `(async () => {
                    const b64 = ${JSON.stringify(b64)}
                    const bin = atob(b64)
                    const arr = new Uint8Array(bin.length)
                    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
                    const file = new File([arr], 'img.jpg', { type: 'image/jpeg' })
                    const dt = new DataTransfer()
                    dt.items.add(file)
                    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })
                    const panel = document.querySelector('.ai-panel')
                    if (!panel) return 'no panel'
                    panel.dispatchEvent(ev)
                    return 'pasted'
                  })()`
                )
                console.log('inject image ->', r)
                await new Promise((res) => setTimeout(res, 1000))
                continue
              }
              const r = await mainWindow.webContents.executeJavaScript(
                `(() => {
                  const sel = '${label}'
                  if (sel.startsWith('.')) {
                    const el = document.querySelector(sel)
                    if (el) { el.click(); return 'clicked(sel)' }
                    return 'not found(sel)'
                  }
                  const btns = [...document.querySelectorAll('button')]
                  const target = btns.find((b) => b.textContent.includes(sel))
                  if (target) { target.click(); return 'clicked' }
                  return 'not found'
                })()`
              )
              console.log('click:', label, '->', r)
              await new Promise((res) => setTimeout(res, 700))
            }
          }
          const image = await mainWindow.webContents.capturePage()
          await writeFile(process.env.LIFEQUEST_SCREENSHOT as string, image.toPNG())
          console.log('screenshot saved:', process.env.LIFEQUEST_SCREENSHOT)
          const text = await mainWindow.webContents.executeJavaScript(
            `(() => {
              let out = '[theme=' + document.documentElement.dataset.theme + ' bg=' + getComputedStyle(document.body).backgroundColor + ' avatar=' + document.querySelectorAll('.avatar').length + ']\\n'
              // 日历格子配色统计（验证颜色是否多样）
              const cells = [...document.querySelectorAll('.cell, .week-col')].filter((c) => !c.classList.contains('empty'))
              if (cells.length) {
                const bgs = [...new Set(cells.map((c) => getComputedStyle(c).backgroundColor))]
                out += '[格子 ' + cells.length + ' 个，不同底色 ' + bgs.length + ' 种]\\n'
                out += bgs.slice(0, 10).join('  ') + '\\n'
                out +=
                  cells
                    .map(
                      (c) =>
                        (c.querySelector('.day')?.textContent || c.className.slice(0, 6)).trim() +
                        '=' +
                        getComputedStyle(c).backgroundColor
                    )
                    .join(' ') + '\\n'
              }
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
          // 打包版抓不到 stdout，可把页面内容写到文件便于验证
          if (process.env.LIFEQUEST_DUMP) {
            await writeFile(process.env.LIFEQUEST_DUMP, text, 'utf-8')
          }
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
