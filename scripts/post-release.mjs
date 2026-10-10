// 发布后处理（Windows 专用：把便携版放到工作区根目录、免解压版放到 app/）
// 1) 便携版单文件 → 工作区根目录 LifeQuest.exe（便于携带/分享，但每次启动要解压，较慢）
// 2) 免解压版 → app/ 目录（启动快，推荐日常使用；数据仍由程序向上找到工作区的 LifeQuest-Data）
// 非 Windows 平台（macOS / Linux）请直接用 CI 或 electron-builder 的产物，这里只做提示。
import { existsSync, rmSync, cpSync, readdirSync, copyFileSync, readFileSync } from 'fs'
import { join } from 'path'

if (process.platform !== 'win32') {
  console.log(`当前平台是 ${process.platform}：跳过 Windows 便携版/免解压版的搬运。`)
  console.log('打包产物在 release/ 目录里（mac 是 .dmg/.zip，linux 是 .AppImage/.deb）。')
  process.exit(0)
}

const rel = 'release'
// 以 package.json 的版本为准挑便携版，避免把 release/ 里残留的旧版本拷出去
const version = JSON.parse(readFileSync('package.json', 'utf-8')).version

// ---- 1) 便携版 ----
if (existsSync(rel)) {
  const portables = readdirSync(rel)
    .filter((f) => f.endsWith('.exe') && !f.includes('unpacked'))
    .sort()
  const portable = portables.find((f) => f.includes(version)) ?? portables[portables.length - 1]
  if (portable) {
    try {
      copyFileSync(join(rel, portable), 'LifeQuest.exe')
      console.log('已更新便携版：LifeQuest.exe  <-', portable)
    } catch (e) {
      if (e && e.code === 'EBUSY') {
        console.log('便携版更新失败：LifeQuest.exe 正在运行（关闭后再执行 npm run release）')
      } else {
        throw e
      }
    }
  }
}

// ---- 2) 免解压版 ----
const src = join(rel, 'win-unpacked')
if (!existsSync(src)) {
  console.error('未找到 release/win-unpacked，请先执行 npm run dist')
  process.exit(1)
}
const dest = 'app'
if (existsSync(dest)) {
  console.log('清理旧的 app/ …')
  rmSync(dest, { recursive: true, force: true })
}
console.log('复制免解压版到 app/ …')
cpSync(src, dest, { recursive: true })
console.log('已更新免解压版：app/LifeQuest.exe')
