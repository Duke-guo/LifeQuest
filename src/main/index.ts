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
              if (label.startsWith('@wheel:')) {
                // 派发滚轮：@wheel:<deltaY> 或 @wheel:<deltaY>@<次数>（逐帧派发并记录帧间隔）
                const parts = label.slice(7).split('@')
                const d = Number(parts[0]) || 0
                const times = Math.max(1, Number(parts[1]) || 1)
                const r = await mainWindow.webContents.executeJavaScript(
                  `(() => {
                    const el = document.querySelector('.strip-wrap') || document.querySelector('.vine-stage')
                    if (!el) return 'no wheel target'
                    const times = ${times}
                    if (times <= 1) {
                      el.dispatchEvent(new WheelEvent('wheel', { deltaY: ${d}, bubbles: true, cancelable: true }))
                      return 'wheel ' + ${d}
                    }
                    window.__ft = []
                    let last = performance.now()
                    let n = 0
                    const step = () => {
                      const t = performance.now()
                      window.__ft.push(t - last)
                      last = t
                      el.dispatchEvent(new WheelEvent('wheel', { deltaY: ${d}, bubbles: true, cancelable: true }))
                      if (++n < times) requestAnimationFrame(step)
                      else window.__ftDone = 1
                    }
                    requestAnimationFrame(step)
                    return 'wheel x' + times
                  })()`
                )
                console.log('wheel ->', r)
                await new Promise((res) => setTimeout(res, 700))
                continue
              }
              if (label.startsWith('@drag:')) {
                // 把第一条 .quest 拖到指定选择器的元素上：@drag:<selector>
                const sel = JSON.stringify(label.slice(6))
                const r = await mainWindow.webContents.executeJavaScript(
                  `(() => {
                    const from = document.querySelector('.quest')
                    const to = document.querySelector(${sel})
                    if (!from || !to) return 'not found'
                    const dt = new DataTransfer()
                    const fire = (el, type) =>
                      el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }))
                    fire(from, 'dragstart')
                    fire(to, 'dragover')
                    fire(to, 'drop')
                    fire(from, 'dragend')
                    return 'dragged'
                  })()`
                )
                console.log('drag ->', r)
                await new Promise((res) => setTimeout(res, 900))
                continue
              }
              if (label.startsWith('@type:')) {
                const text = JSON.stringify(label.slice(6))
                const r = await mainWindow.webContents.executeJavaScript(
                  `(() => {
                    const el = document.activeElement
                    if (!el || (el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT')) return 'no focused field'
                    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
                    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
                    setter.call(el, ${text})
                    el.dispatchEvent(new Event('input', { bubbles: true }))
                    el.blur()
                    return 'typed into ' + el.tagName
                  })()`
                )
                console.log('type ->', r)
                await new Promise((res) => setTimeout(res, 600))
                continue
              }
              if (label.startsWith('@hover:')) {
                // 在指定元素上派发一次鼠标移动（用它在元素内的相对位置）：@hover:<selector>@<0..1>
                const [selPart, fracPart] = label.slice(7).split('@')
                const sel = JSON.stringify(selPart)
                const frac = Number(fracPart)
                const r = await mainWindow.webContents.executeJavaScript(
                  `(() => {
                    const el = document.querySelector(${sel})
                    if (!el) return 'no target'
                    const r = el.getBoundingClientRect()
                    const x = r.left + r.width * (isNaN(${frac}) ? 0.5 : ${frac})
                    const y = r.top + r.height * 0.5
                    el.dispatchEvent(new MouseEvent('mousemove', {
                      bubbles: true, clientX: x, clientY: y
                    }))
                    return 'hover at ' + Math.round(x) + ',' + Math.round(y)
                  })()`
                )
                console.log('hover ->', r)
                await new Promise((res) => setTimeout(res, 260))
                continue
              }
              if (label.startsWith('@eval:')) {
                // 通用逃生口：直接执行一段渲染进程 JS（不加引号、不要逗号，避免和分隔符冲突）
                const code = label.slice(6)
                const r = await mainWindow.webContents.executeJavaScript(
                  `(() => { ${code}; return 'evaled' })()`
                )
                console.log('eval ->', r)
                await new Promise((res) => setTimeout(res, 600))
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
                    if (el) {
                      // HTML 元素用 el.click()：合成事件不会触发「提交表单」这类默认行为；
                      // SVG 元素没有 click()，退回 dispatchEvent
                      if (typeof el.click === 'function') el.click()
                      else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
                      // 合成点击也不会聚焦，需要显式补上，否则后面 @type: 找不到焦点
                      if (typeof el.focus === 'function') el.focus()
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
              const grid = document.querySelector('.grid, .week-grid, .strip-wrap')
              if (grid) {
                const kids = [...grid.querySelectorAll(':scope > .week-col, :scope > .strip-clip .week-col')]
                const clipped = kids.filter((c) => c.scrollHeight > c.clientHeight + 1).length
                out +=
                  '[grid 高 ' + Math.round(grid.getBoundingClientRect().height) +
                  '，格子高 ' + kids.slice(0, 7).map((c) => Math.round(c.getBoundingClientRect().height)).join(',') +
                  '，被裁剪 ' + clipped +
                  '，页面溢出 ' + (document.documentElement.scrollHeight - window.innerHeight) + ']\\n'
              }
              // 连续日带体检：偏移、今天是否在正中、可见列数
              const strip = document.querySelector('.strip-wrap')
              if (strip) {
                const cols = [...document.querySelectorAll('.week-col')]
                const sr = strip.getBoundingClientRect()
                const inView = cols.filter((c) => {
                  const r = c.getBoundingClientRect()
                  return r.right > sr.left + 1 && r.left < sr.right - 1
                })
                const todayCol = cols.find((c) => c.classList.contains('today'))
                const tr = todayCol ? todayCol.getBoundingClientRect() : null
                out +=
                  '[日带 视口宽=' + Math.round(sr.width) + ' 总天=' + cols.length +
                  ' 屏上=' + inView.length +
                  ' 偏移=' + (document.querySelector('.week-flag-layer')?.getAttribute('data-offset') ?? '?') +
                  ' 今天中心x=' + (tr ? Math.round(tr.left + tr.width / 2 - sr.left) : '今天不在屏上') +
                  ']\\n'
                const track = document.querySelector('.strip-track')
                out += '[日带轨道 宽=' + (track ? Math.round(track.getBoundingClientRect().width) : '?') +
                  ' 变换=' + (track ? getComputedStyle(track).transform.slice(0, 40) : '?') + ']\\n'
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
              // 日记葡萄藤体检：果实颜色、果实顶端与果柄末端是否对齐
              const jv = document.querySelector('.jv-track')
              if (jv) {
                const tr = jv.getBoundingClientRect()
                const fruits = [...jv.querySelectorAll('.jv-node')]
                const stems = [...jv.querySelectorAll('.vine-twig')]
                out +=
                  '[日记藤 果实=' + fruits.length +
                  ' 顶端=' + fruits.map((f) => Math.round(f.getBoundingClientRect().top - tr.top)).join(',') +
                  ' 底色=' + fruits.map((f) => getComputedStyle(f).backgroundColor).join(' ') + ']\\n'
                const visibleStems = stems.filter((s) => getComputedStyle(s).display !== 'none')
                out +=
                  '[果柄=' + visibleStems.length + ' 末端y=' +
                  visibleStems
                    .map((s) => {
                      const d = s.getAttribute('d') || ''
                      const nums = d.match(/-?\\d+(\\.\\d+)?/g) || []
                      return nums.length ? Math.round(Number(nums[nums.length - 1])) : '?'
                    })
                    .join(',') +
                  ' 入口=' + visibleStems.filter((s) => s.classList.contains('on')).length + ']\\n'
              }
              // 藤蔓统一样式体检
              const cane = document.querySelector('.vine-cane')
              if (cane) {
                const cs = getComputedStyle(cane)
                out += '[主藤 颜色=' + cs.stroke + ' 宽度=' + cs.strokeWidth + ']\\n'
              }
              // 笔记预览框体检：宽度是否收窄、超长正文是否在框内滚动
              const pv = document.querySelector('.vine-preview')
              if (pv) {
                const pr = pv.getBoundingClientRect()
                const pvBody = pv.querySelector('.pv-body')
                out +=
                  '[笔记预览 宽=' + Math.round(pr.width) + ' 高=' + Math.round(pr.height) +
                  ' 正文可视=' + (pvBody ? Math.round(pvBody.clientHeight) : '?') +
                  ' 正文内容=' + (pvBody ? pvBody.scrollHeight : '?') +
                  ' 可滚=' + (pvBody && pvBody.scrollHeight > pvBody.clientHeight + 1 ? '是' : '否') + ']\\n'
              }
              // 长详情是否被收成一行
              const desc = document.querySelector('.desc')
              if (desc) {
                const r = desc.getBoundingClientRect()
                out +=
                  '[详情 显示高=' + Math.round(r.height) + ' 内容高=' + desc.scrollHeight +
                  ' 行数限制=' + (getComputedStyle(desc).webkitLineClamp || '无') +
                  ' 展开键=' + (document.querySelector('.desc-toggle') ? '有' : '无') + ']\\n'
              }
              // 任务卡宽度体检：按钮挤占后正文还剩多少
              const quest = document.querySelector('.quest')
              if (quest) {
                const inner = quest.querySelector('.inner')
                const body = quest.querySelector('.body')
                const title = quest.querySelector('.title')
                const btns = [...quest.querySelectorAll('.add-child, .locate, .take-note, .remove')]
                out +=
                  '[任务卡 inner=' + (inner ? Math.round(inner.getBoundingClientRect().width) : '?') +
                  ' 正文=' + (body ? Math.round(body.getBoundingClientRect().width) : '?') +
                  ' 按钮=' + btns.length + '个/' + Math.round(btns.reduce((s, b) => s + b.getBoundingClientRect().width, 0)) +
                  ' 标题行数≈' + (title && body ? (Math.round(title.getBoundingClientRect().height / (parseFloat(getComputedStyle(title).lineHeight) || 20)) || 1) : '?') +
                  ']\\n'
              }
              // 截止旗标 + 定位高亮体检
              const flags = document.querySelectorAll('.flag')
              if (flags.length) {
                const layer = document.querySelector('.week-flag-layer')
                const cols = [...document.querySelectorAll('.week-col')]
                const lr = layer ? layer.getBoundingClientRect() : null
                const cr = cols[0] ? cols[0].getBoundingClientRect() : null
                out +=
                  '[旗标层 与首列对齐偏差 top=' +
                  (lr && cr ? Math.round(lr.top - cr.top) : '?') +
                  ' left=' + (lr && cr ? Math.round(lr.left - cr.left) : '?') +
                  ' 宽=' + (lr ? Math.round(lr.width) : '?') +
                  '/' + (cr ? Math.round(cr.width) : '?') +
                  ' 列高=' + (cr ? Math.round(cr.height) : '?') +
                  ' 可插区上沿=' + (document.querySelector('.wc-events') ? document.querySelector('.wc-events').offsetTop : '?') +
                  ' bandRef=' + (layer ? layer.getAttribute('data-band') + '/' + layer.getAttribute('data-refs') : '?') +
                  ']\\n'
                const fcols = [...document.querySelectorAll('.flag-col')]
                const wrapEl = document.querySelector('.strip-wrap, .week-wrap')
                out +=
                  '[列对齐 网格首列: ' + (cols[0] ? Math.round(cols[0].getBoundingClientRect().left) + '+' + Math.round(cols[0].getBoundingClientRect().width) : '?') +
                  ' 旗标首列: ' + (fcols[0] ? Math.round(fcols[0].getBoundingClientRect().left) + '+' + Math.round(fcols[0].getBoundingClientRect().width) : '?') +
                  ' 视口left=' + (wrapEl ? wrapEl.getBoundingClientRect().left.toFixed(1) : '?') +
                  ' 列数=' + cols.length + ']\\n'
                out +=
                  '[截止旗标 ' + flags.length + ' 个: ' +
                  [...flags]
                    .map((f) => {
                      const fr = f.getBoundingClientRect()
                      const col = f.closest('.flag-col')
                      const ci = col ? [...(col.parentElement?.children || [])].indexOf(col) : -1
                      const c = cols[ci]
                      const rel = c ? Math.round(fr.top + fr.height / 2 - c.getBoundingClientRect().top) : -1
                      return (f.textContent || '').trim() + ' 列' + ci + ' 距列顶' + rel +
                        '/可见' + (c ? Math.round(c.getBoundingClientRect().height) : '?') +
                        ' 左' + (c ? Math.round(fr.left - c.getBoundingClientRect().left) : '?') +
                        ' 时刻' + (f.querySelector('.flag-text') && getComputedStyle(f.querySelector('.flag-text')).display !== 'none' ? '显示' : '收起')
                    })
                    .join(' | ') + ']\\n'
              }
              const wg = document.querySelector('.strip-clip, .week-grid')
              if (wg) {
                const cp = getComputedStyle(wg).clipPath
                const track = document.querySelector('.strip-track')
                out += '[日带裁剪=' + (cp && cp !== 'none' ? cp.slice(0, 24) : '无') +
                  ' 总宽=' + (track ? Math.round(track.getBoundingClientRect().width) : '?') + ']\\n'
                const path = document.querySelector('#weekCurve path')
                if (path) {
                  const nums = (path.getAttribute('d') || '').match(/-?\\d+(\\.\\d+)?/g) || []
                  const pts = []
                  for (let i = 4; i + 1 < nums.length; i += 2) pts.push([Number(nums[i]), Number(nums[i + 1])])
                  if (pts.length) {
                    let lo = pts[0]
                    for (const p of pts) if (p[1] > lo[1]) lo = p
                    out += '[曲线最低点 x=' + lo[0].toFixed(3) + ' y=' + lo[1].toFixed(3) +
                      ' 应为第' + (Math.floor(lo[0] * 7) + 1) + '列 采样=' + pts.length + ']\\n'
                  }
                }
              }
              const flashed = document.querySelectorAll('.quest.flash, .dot.flash, .sched-block.flash')
              out += '[定位高亮 ' + flashed.length + ' 个（任务条目/周格事件/时间轴）]\\n'
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
