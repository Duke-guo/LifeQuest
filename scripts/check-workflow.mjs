// 严格校验 workflow 的 YAML：GitHub 会因为「重复键」直接拒绝整个 workflow，
// 而普通 YAML 解析器（含 js-yaml 默认行为）会静默取最后一个键 —— 所以推送前先跑这个。
// 用法：npm run check:workflow
import { readFileSync } from 'node:fs'
import { parseDocument } from 'yaml'

const files = ['.github/workflows/release.yml']
let bad = 0

for (const f of files) {
  const src = readFileSync(f, 'utf-8')
  const doc = parseDocument(src, { uniqueKeys: true })
  if (doc.errors.length) {
    bad++
    console.error(`✗ ${f}`)
    for (const e of doc.errors) console.error('   ' + e.message)
    continue
  }
  const d = doc.toJS()
  const jobs = Object.keys(d.jobs ?? {})
  console.log(`✓ ${f}  jobs=[${jobs.join(', ')}]`)
  for (const [name, job] of Object.entries(d.jobs ?? {})) {
    const steps = (job.steps ?? []).map((s) => s.name ?? s.uses).filter(Boolean)
    console.log(`   ${name}: ${steps.length} 步`)
  }
}

if (bad) {
  console.error('\n有文件没通过校验，GitHub 侧会直接报 invalid workflow file。')
  process.exit(1)
}
console.log('\n全部通过：可以安全推送。')
