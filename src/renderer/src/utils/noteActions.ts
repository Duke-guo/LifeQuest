import { useNotesStore } from '../stores/notes'
import { useLinksStore } from '../stores/links'
import { useTagsStore } from '../stores/tags'
import { toDateStr } from './helpers'
import type { Task } from '../../../shared/types'

/**
 * 从某个「上下文」延伸出一篇新笔记，并返回它的 id（调用方负责跳转/选中）。
 * 用于：笔记内容视图的学科分支下加一篇、葡萄藤某根藤上再加一颗、
 *      任务/日历里对某节课一键写笔记。
 */
export async function extendNote(opts: {
  category?: string
  date?: string
  tags?: string[]
  title?: string
}): Promise<string> {
  const notes = useNotesStore()
  const tags = useTagsStore()
  const names = [...new Set((opts.tags ?? []).map((t) => t.trim()).filter(Boolean))]
  const tagIds: string[] = []
  for (const n of names) tagIds.push((await tags.ensure(n, 'theme')).id)

  return notes.create({
    title: opts.title ?? '未命名笔记',
    category: opts.category ?? '',
    date: opts.date ?? toDateStr(new Date()),
    tags: names,
    tagIds
  })
}

/** 从任务/课程一键写笔记：分类=课程名、日期=发生那天（默认今天），并自动与任务建立关联 */
export async function noteFromTask(task: Task, date?: string): Promise<string> {
  const notes = useNotesStore()
  const links = useLinksStore()
  const id = await notes.create({
    title: '未命名笔记',
    category: task.title,
    date: date ?? toDateStr(new Date())
  })
  await links.add({ kind: 'note', id }, { kind: 'task', id: task.id })
  return id
}
