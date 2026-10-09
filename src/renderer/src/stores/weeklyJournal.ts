import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dataApi } from '../services/data'
import { parseFrontMatter, serializeFrontMatter } from '../utils/frontmatter'

/**
 * 周记：和日记同一个模块（都存在 journal/ 下），只是键不同。
 * 日记按天：journal/2026-10-09.md
 * 周记按周：journal/w2026-10-04.md（文件名带 w 前缀，避免被日志索引当成某一天）
 */
const WEEK_PREFIX = 'w'

export const useWeeklyJournalStore = defineStore('weeklyJournal', () => {
  /** weekStart(YYYY-MM-DD) → 正文 */
  const entries = ref<Record<string, string>>({})
  const loaded = ref(false)

  async function load(): Promise<void> {
    const files = await dataApi.listFiles('journal', '.md')
    const next: Record<string, string> = {}
    for (const f of files) {
      if (!f.startsWith(WEEK_PREFIX)) continue
      const week = f.slice(1).replace(/\.md$/, '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) continue
      const raw = await dataApi.readMarkdown(`journal/${f}`)
      next[week] = parseFrontMatter(raw).body
    }
    entries.value = next
    loaded.value = true
  }

  function of(weekStart: string): string {
    return entries.value[weekStart] ?? ''
  }

  function has(weekStart: string): boolean {
    return (entries.value[weekStart] ?? '').trim().length > 0
  }

  async function save(weekStart: string, body: string): Promise<void> {
    await dataApi.writeMarkdown(
      `journal/${WEEK_PREFIX}${weekStart}.md`,
      serializeFrontMatter({ week: weekStart }, body)
    )
    entries.value = { ...entries.value, [weekStart]: body }
  }

  async function remove(weekStart: string): Promise<void> {
    await dataApi.deleteFile(`journal/${WEEK_PREFIX}${weekStart}.md`)
    const next = { ...entries.value }
    delete next[weekStart]
    entries.value = next
  }

  return { entries, loaded, load, of, has, save, remove }
})
