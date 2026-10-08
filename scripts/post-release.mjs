// 发布后处理：
// 1) 便携版单文件 → 工作区根目录 LifeQuest.exe（便于携带/分享，但每次启动要解压，较慢）
// 2) 免解压版 → app/ 目录（启动快，推荐日常使用；数据仍由程序向上找到工作区的 LifeQuest-Data）
import { existsSync, rmSync, cpSync, readdirSync, copyFileSync } from 'fs'
import { join } from 'path'

const rel = 'release'

// ---- 1) 便携版 ----
if (existsSync(rel)) {
  const portable = readdirSync(rel).find((f) => f.endsWith('.exe'))
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
