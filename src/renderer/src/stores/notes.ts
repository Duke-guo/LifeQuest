import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dataApi } from '../services/data'
import { parseFrontMatter, serializeFrontMatter, type FrontMatter } from '../utils/frontmatter'
import { uid, toDateStr } from '../utils/helpers'
import type { EntityRef } from '../../../shared/types'

export type NoteAttachment = {
  name: string
  file: string
}

export interface Note {
  id: string
  title: string
  category: string
  date: string
  theme: string[]
  rating: number
  tags: string[]
  tagIds: string[]
  images: string[]
  attachments: NoteAttachment[]
  links: EntityRef[]
  content: string
}

function toArr(v: unknown): string[] {
  if (v === undefined || v === null) return []
  if (Array.isArray(v)) return v.map(String)
  return [String(v)]
}

function toAttachments(v: unknown): NoteAttachment[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((a) => a && typeof a === 'object')
    .map((a) => {
      const o = a as Record<string, unknown>
      return { name: String(o.name ?? ''), file: String(o.file ?? '') }
    })
    .filter((a) => a.file)
}

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<Note[]>([])
  const currentId = ref<string | null>(null)

  const current = computed(() => notes.value.find((n) => n.id === currentId.value) ?? null)

  const categories = computed(() => {
    const set = new Set<string>()
    for (const n of notes.value) if (n.category.trim()) set.add(n.category.trim())
    return [...set]
  })

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
        category: (meta.category as string) || '',
        date: (meta.date as string) || '',
        theme: toArr(meta.theme),
        rating: typeof meta.rating === 'number' ? meta.rating : 3,
        tags: toArr(meta.tags),
        tagIds: toArr(meta.tagIds),
        images: toArr(meta.images),
        attachments: toAttachments(meta.attachments),
        links: [],
        content: body
      })
    }
    notes.value = loaded.sort((a, b) => (a.date < b.date ? 1 : -1))
  }

  async function create(patch: Partial<Note> = {}): Promise<string> {
    const note: Note = {
      id: uid(),
      title: '未命名笔记',
      category: '',
      date: toDateStr(new Date()),
      theme: [],
      rating: 3,
      tags: [],
      tagIds: [],
      images: [],
      attachments: [],
      links: [],
      content: '',
      ...patch
    }
    notes.value.unshift(note)
    currentId.value = note.id
    await persist(note)
    return note.id
  }

  async function persist(note: Note): Promise<void> {
    const meta: FrontMatter = {
      title: note.title,
      date: note.date,
      rating: note.rating
    }
    if (note.category) meta.category = note.category
    if (note.theme.length) meta.theme = note.theme
    if (note.tags.length) meta.tags = note.tags
    if (note.tagIds.length) meta.tagIds = note.tagIds
    if (note.images.length) meta.images = note.images
    if (note.attachments.length) meta.attachments = note.attachments
    await dataApi.writeMarkdown(`notes/${note.id}.md`, serializeFrontMatter(meta, note.content))
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

  function byId(id: string): Note | undefined {
    return notes.value.find((n) => n.id === id)
  }

  return { notes, currentId, current, categories, list, create, persist, saveCurrent, remove, byId }
})
