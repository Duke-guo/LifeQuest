import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dataApi } from '../services/data'
import { parseFrontMatter, serializeFrontMatter, type FrontMatter } from '../utils/frontmatter'
import { toDateStr } from '../utils/helpers'
import type { Weather, Mood } from '../../../shared/types'

function toArr(v: unknown): string[] {
  if (v === undefined || v === null) return []
  if (Array.isArray(v)) return v.map(String)
  return [String(v)]
}

export const useJournalStore = defineStore('journal', () => {
  const date = ref(toDateStr(new Date()))
  const content = ref('')
  const weather = ref<Weather | null>(null)
  const mood = ref<Mood | null>(null)
  const tags = ref<string[]>([])
  const prompts = ref<string[]>([])
  const loaded = ref(false)

  async function load(d: string): Promise<void> {
    date.value = d
    const raw = await dataApi.readMarkdown(`journal/${d}.md`)
    const { meta, body } = parseFrontMatter(raw)
    content.value = body
    weather.value = (meta.weather as Weather) || null
    mood.value = (meta.mood as Mood) || null
    tags.value = toArr(meta.tags)
    prompts.value = toArr(meta.prompts)
    loaded.value = true
  }

  async function save(): Promise<void> {
    const meta: FrontMatter = { date: date.value }
    if (weather.value) meta.weather = weather.value
    if (mood.value) meta.mood = mood.value
    if (tags.value.length) meta.tags = tags.value
    if (prompts.value.length) meta.prompts = prompts.value
    await dataApi.writeMarkdown(`journal/${date.value}.md`, serializeFrontMatter(meta, content.value))
  }

  return { date, content, weather, mood, tags, prompts, loaded, load, save }
})
