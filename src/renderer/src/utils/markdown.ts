/**
 * 极简 Markdown 渲染器（自写，不引第三方依赖）
 * 支持：标题、粗体/斜体/删除线、行内代码、代码块、有序/无序列表、
 *      引用、分隔线、链接、图片（可用 assets 文件名）、段落与换行。
 * 先转义 HTML 再拼标签，正文里的尖括号不会变成注入。
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 把 assets 文件名解析成可显示的 src（data URL），解析不到就原样返回 */
export type ImageResolver = (name: string) => string | undefined

function inline(src: string, resolve?: ImageResolver): string {
  let t = escapeHtml(src)

  // 行内代码（先抽出来，避免里面的 * _ 被当成强调）
  const codes: string[] = []
  t = t.replace(/`([^`]+)`/g, (_m, c: string) => {
    codes.push(c)
    return `\u0000CODE${codes.length - 1}\u0000`
  })

  // 图片 ![alt](src)
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, href: string) => {
    let url = href
    if (resolve && !/^[a-z]+:|^\/|^data:/i.test(href)) url = resolve(href) ?? href
    return `<img src="${url}" alt="${alt}" loading="lazy">`
  })

  // 链接 [文字](url)：target=_blank 会走主进程的 setWindowOpenHandler 用系统浏览器打开
  t = t.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, text: string, href: string) =>
      `<a href="${href}" target="_blank" rel="noreferrer">${text}</a>`
  )

  // 强调
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  t = t.replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>')

  // 还原行内代码
  t = t.replace(/\u0000CODE(\d+)\u0000/g, (_m, i: string) => `<code>${codes[Number(i)]}</code>`)
  return t
}

export function renderMarkdown(src: string, resolve?: ImageResolver): string {
  const lines = (src ?? '').replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let list: 'ul' | 'ol' | null = null
  let taskIdx = 0
  let i = 0

  const closeList = (): void => {
    if (list) {
      out.push(`</${list}>`)
      list = null
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    // ``` 代码块
    if (/^\s*```/.test(line)) {
      closeList()
      const buf: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      i++
      out.push(`<pre class="md-code"><code>${escapeHtml(buf.join('\n'))}</code></pre>`)
      continue
    }

    // 标题
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      closeList()
      const lv = h[1].length
      out.push(`<h${lv}>${inline(h[2], resolve)}</h${lv}>`)
      i++
      continue
    }

    // 分隔线
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      closeList()
      out.push('<hr>')
      i++
      continue
    }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      closeList()
      const buf: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      out.push(`<blockquote>${buf.map((b) => inline(b, resolve)).join('<br>')}</blockquote>`)
      continue
    }

    // 列表
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line)
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (ul || ol) {
      const want: 'ul' | 'ol' = ul ? 'ul' : 'ol'
      if (list !== want) {
        closeList()
        out.push(`<${want}>`)
        list = want
      }
      const body = (ul ?? ol)![1]
      // - [ ] / - [x] 任务清单：渲染成真正的复选框
      const task = /^\[([ xX])\]\s+(.*)$/.exec(body)
      if (task) {
        const checked = task[1].toLowerCase() === 'x'
        out.push(
          `<li class="md-task"><input type="checkbox" data-task-idx="${taskIdx++}" ${checked ? 'checked' : ''}><span>${inline(task[2], resolve)}</span></li>`
        )
      } else {
        out.push(`<li>${inline(body, resolve)}</li>`)
      }
      i++
      continue
    }

    // 空行
    if (!line.trim()) {
      closeList()
      i++
      continue
    }

    // 段落（连续非空行合并，行内换行保留）
    closeList()
    const buf: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*[-*+]\s/.test(lines[i]) &&
      !/^\s*\d+[.)]\s/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !/^\s*```/.test(lines[i])
    ) {
      buf.push(lines[i])
      i++
    }
    out.push(`<p>${buf.map((b) => inline(b, resolve)).join('<br>')}</p>`)
  }

  closeList()
  return out.join('\n')
}
