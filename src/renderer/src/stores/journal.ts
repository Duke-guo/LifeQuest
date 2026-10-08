import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dataApi } from '../services/data'
import { toDateStr } from '../utils/helpers'

export const useJournalStore = defineStore('journal', () => {
  const date = ref(toDateStr(new Date()))
  const content = ref('')
  const loaded = ref(false)

  async function load(d: string): Promise<void> {
    date.value = d
    content.value = await dataApi.readMarkdown(`journal/${d}.md`)
    loaded.value = true
  }

  async function save(): Promise<void> {
    await dataApi.writeMarkdown(`journal/${date.value}.md`, content.value)
  }

  return { date, content, loaded, load, save }
})
