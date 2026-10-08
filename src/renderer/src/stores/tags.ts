import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dataApi } from '../services/data'
import type { Tag, TagsFile, TagKind } from '../../../shared/types'
import { uid } from '../utils/helpers'

const PALETTE = ['#d95050', '#d98a2b', '#d9a52b', '#55a89f', '#5b8def', '#9b6bd9', '#d96ba0']

export const useTagsStore = defineStore('tags', () => {
  const tags = ref<Tag[]>([])

  async function load(): Promise<void> {
    const file = await dataApi.readTags()
    tags.value = file?.tags ?? []
  }

  async function persist(): Promise<void> {
    const file: TagsFile = { schemaVersion: 1, tags: tags.value }
    await dataApi.writeTags(file)
  }

  /** 取标签，不存在则创建 */
  async function ensure(name: string, kind: TagKind = 'custom'): Promise<Tag> {
    const n = name.trim()
    const found = tags.value.find((t) => t.name === n)
    if (found) return found
    const tag: Tag = { id: uid(), name: n, color: PALETTE[tags.value.length % PALETTE.length], kind }
    tags.value.push(tag)
    await persist()
    return tag
  }

  function byId(id: string): Tag | undefined {
    return tags.value.find((t) => t.id === id)
  }

  function byName(name: string): Tag | undefined {
    return tags.value.find((t) => t.name === name)
  }

  function colorOf(name: string): string {
    return byName(name)?.color ?? 'var(--text-3)'
  }

  async function remove(id: string): Promise<void> {
    tags.value = tags.value.filter((t) => t.id !== id)
    await persist()
  }

  return { tags, load, persist, ensure, byId, byName, colorOf, remove }
})
