// 开发调试工具：列出当前 AI 接口可用的模型
import { readFileSync } from 'fs'

const settings = JSON.parse(readFileSync('LifeQuest-Data/config/settings.json', 'utf8'))
const ai = settings.ai
if (!ai || !ai.apiKey) {
  console.error('settings.json 中未配置 ai.apiKey')
  process.exit(1)
}

console.log(`接口: ${ai.baseUrl}`)
console.log(`Key : 已配置（长度 ${ai.apiKey.length}）`)
console.log(`当前模型: ${ai.model}`)
console.log('--- 拉取模型列表 ---')

try {
  const res = await fetch(`${ai.baseUrl.replace(/\/+$/, '')}/models`, {
    headers: { Authorization: `Bearer ${ai.apiKey}` }
  })
  console.log('HTTP', res.status)
  const text = await res.text()
  if (!res.ok) {
    console.log(text.slice(0, 1000))
    process.exit(1)
  }
  const json = JSON.parse(text)
  const list = json.data ?? json.models ?? json
  if (Array.isArray(list)) {
    for (const m of list) console.log('·', m.id ?? m.name ?? JSON.stringify(m))
  } else {
    console.log(JSON.stringify(json, null, 2).slice(0, 3000))
  }
} catch (e) {
  console.error('请求失败：', e.message)
  process.exit(1)
}
