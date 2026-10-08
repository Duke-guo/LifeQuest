import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dataApi } from '../services/data'
import { parseFrontMatter, serializeFrontMatter } from '../utils/frontmatter'
import { uid, toDateStr } from '../utils/helpers'

export interface Note {
  id: string
  title: string
  date: string
  theme: string[]
  rating: number
  tags: string[]
  content: string
}

function toArray(v: unknown): string[] {
  if (v === undefined || v === null) return []
  if (Array.isArray(v)) return v.map(String)
  return [String(v)]
}

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<Note[]>([])
  const currentId = ref<string | null>(null)

  const current = computed(() => notes.value.find((n) => n.id === currentId.value) ?? null)

  async function list(): Promise<void> {
    const files = await dataApi.listFiles('notes', '.md')
    const loaded: Note[] = []
    for (const f of files) {
      const raw = await dataApi.readMarkdown(`notes/${f}`)
      const { meta, body } = parseFrontMatter(raw)
      const firstLine = body.split('\n').find((l) => l.trim()) ?? ''
      loaded.push({
        id: f.replace(/\.md$/, ''),
        title: (meta.title as string) || firstLine || '未命名笔记',
        date: (meta.date as string) || '',
        theme: toArray(meta.theme),
        rating: typeof meta.rating === 'number' ? meta.rating : 3,
        tags: toArray(meta.tags),
        content: body
      })
    }
    notes.value = loaded.sort((a, b) => (a.date < b.date ? 1 : -1))
  }

  async function create(): Promise<void> {
    const note: Note = {
      id: uid(),
      title: '未命名笔记',
      date: toDateStr(new Date()),
      theme: [],
      rating: 3,
      tags: [],
      content: ''
    }
    notes.value.unshift(note)
    currentId.value = note.id
    await persist(note)
  }

  async function persist(note: Note): Promise<void> {
    const meta = {
      title: note.title,
      date: note.date,
      theme: note.theme,
      rating: note.rating,
      tags: note.tags
    }
    const out = serializeFrontMatter(meta, note.content)
    await dataApi.writeMarkdown(`notes/${note.id}.md`, out)
  }

  async function saveCurrent(patch: Partial<Note>): Promise<void> {
    const n = current.value
    if (!n) return
    Object.assign(n, patch)
    await persist(n)
  }

  async function remove(id: string): Promise<void> {
    await dataApi.deleteFile(`notes/${id}.md`)
    notes.value = notes.value.filter((n) => n.id !== id)
    if (currentId.value === id) currentId.value = null
  }

  return { notes, currentId, current, list, create, saveCurrent, remove }
})
