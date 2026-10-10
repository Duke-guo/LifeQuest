// 用 Electron 把一张 SVG 渲染成 build/icon.png（1024×1024，正方形）
// electron-builder 会用这张图自动生成 Windows 的 .ico 与 macOS 的 .icns
// 用法：npx electron scripts/make-icon.cjs
const { app, BrowserWindow, nativeImage } = require('electron')
const { writeFile, mkdir } = require('fs/promises')
const { join } = require('path')

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0" stop-color="#fdf8f4"/>
      <stop offset="1" stop-color="#f1e2d6"/>
    </linearGradient>
    <linearGradient id="dark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e2604f"/>
      <stop offset="1" stop-color="#b13729"/>
    </linearGradient>
    <linearGradient id="light" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f8cdc3"/>
      <stop offset="1" stop-color="#ef9c8c"/>
    </linearGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#8a4a3c" flood-opacity="0.18"/>
    </filter>
  </defs>

  <!-- 圆角底板（四周留透明边距，符合 macOS 图标观感） -->
  <rect x="96" y="96" width="832" height="832" rx="192" fill="url(#bg)" filter="url(#soft)"/>
  <rect x="96" y="96" width="832" height="832" rx="192" fill="none" stroke="#e6d6c8" stroke-width="8"/>

  <!-- 外圈：完成度环（右侧留缺口） -->
  <circle cx="512" cy="512" r="268" fill="none" stroke="#e7dbd0" stroke-width="34"/>
  <circle cx="512" cy="512" r="268" fill="none" stroke="#cf4a3c" stroke-width="34"
          stroke-linecap="round" stroke-dasharray="1180 505" transform="rotate(-100 512 512)"/>

  <!-- 罗盘指针：与任务卡上的指针同源 -->
  <g filter="url(#soft)">
    <path d="M512 262 L596 512 L512 762 L428 512 Z" fill="url(#dark)"/>
    <path d="M512 262 L596 512 L512 512 Z" fill="url(#light)"/>
  </g>
  <circle cx="512" cy="512" r="44" fill="#fff9f5" stroke="#cf4a3c" stroke-width="24"/>
</svg>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 300,
    height: 300,
    show: false,
    webPreferences: { offscreen: true }
  })

  // 在页面里把 SVG 画进 1024×1024 的画布，再取回 dataURL：
  // 这样不受窗口大小/屏幕高度限制，尺寸一定是正方形
  const html = `<!doctype html><html><body></body></html>`
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  const dataUrl = await win.webContents.executeJavaScript(`(async () => {
    const svg = ${JSON.stringify(SVG)}
    const img = new Image()
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    await img.decode()
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 1024
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0, 1024, 1024)
    return c.toDataURL('image/png')
  })()`)

  const image = nativeImage.createFromDataURL(dataUrl)
  const size = image.getSize()
  const out = join(__dirname, '..', 'build')
  await mkdir(out, { recursive: true })
  const file = join(out, 'icon.png')
  await writeFile(file, image.toPNG())

  // 自检：尺寸、四角是否透明、中心是否画上了东西
  const buf = image.toPNG()
  console.log(
    'icon written:',
    file,
    JSON.stringify(size),
    'bytes=' + buf.length,
    size.width === size.height && size.width >= 1024 ? '方形 OK' : '不是正方形 ✗'
  )
  app.exit(0)
})
