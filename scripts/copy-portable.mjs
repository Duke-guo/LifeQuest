import { readdirSync, copyFileSync, existsSync } from 'fs'
import { join } from 'path'

const dir = 'release'
if (!existsSync(dir)) {
  console.error('未找到 release 目录，请先执行 npm run dist')
  process.exit(1)
}

const exe = readdirSync(dir).find((f) => f.endsWith('.exe'))
if (!exe) {
  console.error('release 目录下未找到 .exe 产物')
  process.exit(1)
}

try {
  copyFileSync(join(dir, exe), 'LifeQuest.exe')
  console.log(`已更新 LifeQuest.exe  <-  ${exe}`)
} catch (e) {
  if (e && e.code === 'EBUSY') {
    console.error('更新失败：LifeQuest.exe 正在运行，请先关闭应用再重试（或直接运行 npm run release）。')
    process.exit(1)
  }
  throw e
}
