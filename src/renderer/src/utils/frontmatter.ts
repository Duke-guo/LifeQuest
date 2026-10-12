export type FrontMatterValue = string | string[] | number | Record<string, unknown> | Record<string, unknown>[]

export interface FrontMatter {
  [key: string]: FrontMatterValue | undefined
}

/** 解析 Markdown 文件头部的 YAML front matter（`---` 包围段） */
export function parseFrontMatter(content: string): { meta: FrontMatter; body: string } {
  const trimmed = content.replace(/^\uFEFF/, '')
  if (!trimmed.startsWith('---')) {
    return { meta: {}, body: trimmed }
  }
  const end = trimmed.indexOf('\n---', 3)
  if (end === -1) {
    return { meta: {}, body: trimmed }
  }
  const raw = trimmed.slice(3, end).trim()
  // 头部与正文之间的空行全部吃掉：
  // serialize 那边固定写一个空行做分隔，这里若只吃一个，每次保存就会多出一行空行
  const body = trimmed.slice(end + 4).replace(/^(?:\r?\n)+/, '')
  const meta: FrontMatter = {}
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (value.startsWith('[') || value.startsWith('{')) {
      // 对象/对象数组（如附件）用 JSON 写：先试着按 JSON 解析
      try {
        meta[key] = JSON.parse(value)
        continue
      } catch {
        // 不是 JSON，退回旧式逗号分隔的字符串数组（如 [a, b, c]）
        if (value.startsWith('[') && value.endsWith(']')) {
          meta[key] = value
            .slice(1, -1)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
          continue
        }
      }
    }
    if (/^\d+$/.test(value)) {
      meta[key] = Number(value)
    } else {
      meta[key] = value
    }
  }
  return { meta, body }
}

/** 序列化为带 front matter 的 Markdown 文本 */
export function serializeFrontMatter(meta: FrontMatter, body: string): string {
  const lines: string[] = ['---']
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      // 全字符串/数字 → 逗号分隔；含对象（附件）→ JSON
      const allPrimitive = value.every((v) => typeof v === 'string' || typeof v === 'number')
      lines.push(`${key}: ${allPrimitive ? `[${value.join(', ')}]` : JSON.stringify(value)}`)
    } else if (value !== null && typeof value === 'object') {
      lines.push(`${key}: ${JSON.stringify(value)}`)
    } else {
      lines.push(`${key}: ${value}`)
    }
  }
  lines.push('---', '', body)
  return lines.join('\n')
}
