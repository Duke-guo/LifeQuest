import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { writeFile, readFile } from 'fs/promises'
import { setupIpc } from './ipc'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    // 自绘标题栏：顶部那三个窗口按钮由应用自己画（见 components/TitleBar.vue）
    frame: false,
    backgroundColor: '#f6f4f4',
    title: 'LifeQuest',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  // 最大化状态同步给渲染进程（按钮图标要跟着变）
  const sendMax = (v: boolean): void => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('window:maximized', v)
  }
  mainWindow.on('maximize', () => sendMax(true))
  mainWindow.on('unmaximize', () => sendMax(false))

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
                    // 用 dispatchEvent 而不是 el.click()：SVG 元素没有 click() 方法
                    if (el) {
                      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
                      return 'clicked(sel)'
                    }
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
              // 布局体检：格子是否被裁剪 / 页面是否溢出
              const grid = document.querySelector('.grid, .week-grid')
              if (grid) {
                const kids = [...grid.children]
                const clipped = kids.filter((c) => c.scrollHeight > c.clientHeight + 1).length
                out +=
                  '[grid 高 ' + Math.round(grid.getBoundingClientRect().height) +
                  '，格子高 ' + kids.slice(0, 7).map((c) => Math.round(c.getBoundingClientRect().height)).join(',') +
                  '，被裁剪 ' + clipped +
                  '，页面溢出 ' + (document.documentElement.scrollHeight - window.innerHeight) + ']\\n'
              }
              // 葡萄藤几何体检：每粒葡萄相对舞台的 top/left
              const stage = document.querySelector('.vine-stage')
              const grapes = [...document.querySelectorAll('.grape')]
              if (stage && grapes.length) {
                const sr = stage.getBoundingClientRect()
                out +=
                  '[葡萄 ' + grapes.length + ' 粒 top/left: ' +
                  grapes
                    .map(
                      (g) =>
                        Math.round(g.getBoundingClientRect().top - sr.top) +
                        '/' +
                        Math.round(g.getBoundingClientRect().left - sr.left)
                    )
                    .join('  ') + ']\\n'
              }
              // 页头按钮样式体检（验证卡通风格是否生效）
              const nb = document.querySelector('.new-btn, .cartoon-btn')
              if (nb) {
                const cs = getComputedStyle(nb)
                out +=
                  '[按钮 font=' + cs.fontFamily.split(',')[0] + ' 圆角=' + cs.borderRadius +
                  ' 边框=' + cs.borderWidth + ' 阴影=' + (cs.boxShadow === 'none' ? '无' : '有') + ']\\n'
              }
              // 自绘标题栏体检
              const tb = document.querySelector('.titlebar')
              if (tb) {
                const r = tb.getBoundingClientRect()
                const wbs = [...document.querySelectorAll('.wb')]
                out +=
                  '[标题栏 高=' + Math.round(r.height) + ' 窗口键=' + wbs.length +
                  ' 键位=' + wbs.map((b) => Math.round(b.getBoundingClientRect().width)).join(',') +
                  ' 拖拽区=' + (getComputedStyle(tb).webkitAppRegion || '无') + ']\\n'
              }
              // 周横幅渐变体检
              const wb = document.querySelector('.week-banner')
              if (wb) {
                const bg = getComputedStyle(wb).backgroundImage
                out += '[周横幅 渐变=' + (bg.includes('gradient') ? '有' : '无') + ' 色标数=' + (bg.match(/rgb/g) || []).length + ']\\n'
              }
              // 性质条体检：空白占位 / 各类性质
              const bars = [...document.querySelectorAll('.phase-bar, .wc-phase')]
              if (bars.length) {
                const cnt = {}
                for (const b of bars) {
                  for (const c of b.classList) {
                    if (c.startsWith('p-')) cnt[c] = (cnt[c] || 0) + 1
                  }
                }
                out +=
                  '[性质条 ' + bars.length + ' 个: ' +
                  Object.entries(cnt).map(([k, v]) => k + '×' + v).join(' ') + ']\\n'
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

// 自绘标题栏的窗口控制
function windowOf(e: { sender: Electron.WebContents }): BrowserWindow | null {
  return BrowserWindow.fromWebContents(e.sender)
}

ipcMain.handle('window:minimize', (e) => {
  windowOf(e)?.minimize()
})

ipcMain.handle('window:toggleMaximize', (e) => {
  const w = windowOf(e)
  if (!w) return false
  if (w.isMaximized()) w.unmaximize()
  else w.maximize()
  return w.isMaximized()
})

ipcMain.handle('window:close', (e) => {
  windowOf(e)?.close()
})

ipcMain.handle('window:isMaximized', (e) => windowOf(e)?.isMaximized() ?? false)

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
