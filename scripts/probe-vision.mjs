// 开发调试工具：用同一张图片逐个测试可用的模型，找出能读图的那个
// 用法：node scripts/probe-vision.mjs [图片路径]

import { readFileSync } from 'fs'

const settings = JSON.parse(readFileSync('LifeQuest-Data/config/settings.json', 'utf8'))
const ai = settings.ai
if (!ai || !ai.apiKey) {
  console.error('settings.json 中未配置 ai.apiKey')
  process.exit(1)
}

const imgPath = process.argv[2] ?? '532b9d93fb4724e19c5f8f3687ab339f.jpg'
const ext = imgPath.split('.').pop()?.toLowerCase() ?? 'png'
const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
const dataUrl = `data:${mime};base64,${readFileSync(imgPath).toString('base64')}`

const PROMPT = `你是一个日程识别助手。请阅读这张图片（可能是课表、通知、日程截图、手写便签、海报等），提取其中所有事项，只输出 JSON 数组，不要输出任何解释文字。
每个元素格式：
{"title":"事项标题","weekday":1-7 或 null,"date":"YYYY-MM-DD 或 null","startTime":"HH:mm 或 null","endTime":"HH:mm 或 null","location":"地点或 null","importance":3}
说明：
- weekday 表示星期几，1=周一 … 7=周日。课表类图片请务必填 weekday。
- date 只在图片里出现具体日期时才填，否则填 null。
- importance 取 1-5 的整数。无法确定的字段填 null。`

const only = process.argv[3]

const base = ai.baseUrl.replace(/\/+$/, '')

const mres = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${ai.apiKey}` } })
const models = ((await mres.json()).data ?? []).map((m) => m.id)
console.log('可用模型:', models.join(', '))
console.log('测试图片:', imgPath)

for (const model of only ? models.filter((m) => m === only) : models) {
  console.log(`\n===== ${model} =====`)
  const started = Date.now()
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ]
      })
    })
    console.log(`HTTP ${res.status}  (${((Date.now() - started) / 1000).toFixed(1)}s)`)
    const text = await res.text()
    if (!res.ok) {
      console.log('错误:', text.slice(0, 500))
      continue
    }
    const json = JSON.parse(text)
    const content = json.choices?.[0]?.message?.content ?? ''
    const match = content.match(/\[[\s\S]*\]/)
    if (match) {
      const items = JSON.parse(match[0])
      console.log(`✅ 识别出 ${items.length} 条：`)
      for (const it of items) {
        const wd = it.weekday ? `周${'一二三四五六日'[it.weekday - 1]}` : '—'
        console.log(
          `   · ${it.title} | ${wd} | ${it.date ?? ''} | ${it.startTime ?? ''}${it.endTime ? '-' + it.endTime : ''} | ${it.location ?? ''}`
        )
      }
    } else {
      console.log('⚠️ 有返回但没解析出 JSON 数组，原文前 600 字：')
      console.log(content.slice(0, 600))
    }
  } catch (e) {
    console.log('异常:', e.message)
  }
}
