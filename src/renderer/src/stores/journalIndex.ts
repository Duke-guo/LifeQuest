import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dataApi } from '../services/data'
import { parseFrontMatter } from '../utils/frontmatter'
import type { Weather, Mood } from '../../../shared/types'

export interface JournalIndexEntry {
  date: string
  weather: Weather | null
  mood: Mood | null
  tags: string[]
  hasContent: boolean
}

function toArr(v: unknown): string[] {
  if (v === undefined || v === null) return []
  if (Array.isArray(v)) return v.map(String)
  return [String(v)]
}

/** 日记索引：供日历染色 / 回顾使用（不加载正文） */
export const useJournalIndexStore = defineStore('journalIndex', () => {
  const entries = ref<JournalIndexEntry[]>([])

  async function load(): Promise<void> {
    const files = await dataApi.listFiles('journal', '.md')
    const out: JournalIndexEntry[] = []
    for (const f of files) {
      const date = f.replace(/\.md$/, '')
      const raw = await dataApi.readMarkdown(`journal/${f}`)
      const { meta, body } = parseFrontMatter(raw)
      out.push({
        date,
        weather: (meta.weather as Weather) || null,
        mood: (meta.mood as Mood) || null,
        tags: toArr(meta.tags),
        hasContent: body.trim().length > 0
      })
    }
    out.sort((a, b) => (a.date < b.date ? -1 : 1))
    entries.value = out
  }

  function on(date: string): JournalIndexEntry | undefined {
    return entries.value.find((e) => e.date === date)
  }

  return { entries, load, on }
})
