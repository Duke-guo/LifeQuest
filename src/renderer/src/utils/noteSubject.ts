import type { Link, Task } from '../../../shared/types'

/**
 * 笔记的「学科」：优先用笔记自己的分类，
 * 其次看它关联的课程/任务标题，都没有就归到「未分类」。
 * 葡萄藤的学科主线和笔记列表的内容视图都用这一套判定，保证两处一致。
 */
export function subjectOfNote(
  noteId: string,
  category: string,
  links: Link[],
  tasks: Task[]
): string {
  if (category && category.trim()) return category.trim()
  for (const l of links) {
    let other = null
    if (l.from.kind === 'note' && l.from.id === noteId) other = l.to
    else if (l.to.kind === 'note' && l.to.id === noteId) other = l.from
    if (other && other.kind === 'task') {
      const t = tasks.find((x) => x.id === other.id)
      if (t) return t.title
    }
  }
  return '未分类'
}
