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

copyFileSync(join(dir, exe), 'LifeQuest.exe')
console.log(`已更新 LifeQuest.exe  <-  ${exe}`)
