// 开发调试工具：用 settings.json 里的 AI 配置，对一张图片跑一次识图，
// 用于排查「AI 识图」功能（与主进程 ipc.ts 中的调用保持一致）。
//
// 用法：node scripts/test-ai.mjs <图片路径>

import { readFileSync } from 'fs'

const imgPath = process.argv[2]
if (!imgPath) {
  console.error('用法：node scripts/test-ai.mjs <图片路径>')
  process.exit(1)
}

const settings = JSON.parse(readFileSync('LifeQuest-Data/config/settings.json', 'utf8'))
const ai = settings.ai
if (!ai || !ai.apiKey) {
  console.error('settings.json 中未配置 AI（缺少 ai.apiKey）')
  process.exit(1)
}

const ext = imgPath.split('.').pop()?.toLowerCase() ?? 'png'
const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
const dataUrl = `data:${mime};base64,${readFileSync(imgPath).toString('base64')}`

const PROMPT = `你是一个日程识别助手。请阅读这张图片（可能是课表、通知、日程截图、手写便签、海报等），提取其中所有事项，只输出 JSON 数组，不要输出任何解释文字。
每个元素格式：
{"title":"事项标题","date":"YYYY-MM-DD 或 null","startTime":"HH:mm 或 null","endTime":"HH:mm 或 null","location":"地点或 null","importance":3}
importance 取 1-5 的整数。无法确定的字段填 null。`

console.log(`接口: ${ai.baseUrl}  模型: ${ai.model}  Key长度: ${ai.apiKey.length}`)
console.log('请求中…')

try {
  const res = await fetch(`${ai.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ai.apiKey}`
    },
    body: JSON.stringify({
      model: ai.model,
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

  console.log('HTTP', res.status)
  const text = await res.text()
  if (!res.ok) {
    console.log('错误响应：')
    console.log(text.slice(0, 1200))
    process.exit(1)
  }
  const json = JSON.parse(text)
  const content = json.choices?.[0]?.message?.content ?? ''
  console.log('--- 模型返回 ---')
  console.log(content)
  const match = content.match(/\[[\s\S]*\]/)
  if (match) {
    const items = JSON.parse(match[0])
    console.log('--- 解析出', items.length, '条事项 ---')
    for (const it of items) {
      console.log(
        `· ${it.title}  ${it.date ?? '无日期'}  ${it.startTime ?? ''}${it.endTime ? '-' + it.endTime : ''}  ${it.location ?? ''}  ★${it.importance}`
      )
    }
  } else {
    console.log('（未能从返回中解析出 JSON 数组）')
  }
} catch (e) {
  console.error('请求失败：', e.message)
  process.exit(1)
}
