import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dataApi } from '../services/data'
import type { Link, LinksFile, EntityRef } from '../../../shared/types'
import { uid } from '../utils/helpers'

export const useLinksStore = defineStore('links', () => {
  const links = ref<Link[]>([])

  async function load(): Promise<void> {
    const file = await dataApi.readLinks()
    links.value = file?.links ?? []
  }

  async function persist(): Promise<void> {
    const file: LinksFile = { schemaVersion: 1, links: links.value }
    await dataApi.writeLinks(file)
  }

  async function add(from: EntityRef, to: EntityRef, label?: string): Promise<void> {
    const exists = links.value.some(
      (l) =>
        l.from.kind === from.kind &&
        l.from.id === from.id &&
        l.to.kind === to.kind &&
        l.to.id === to.id
    )
    if (exists) return
    links.value.push({ id: uid(), from, to, label })
    await persist()
  }

  async function remove(id: string): Promise<void> {
    links.value = links.value.filter((l) => l.id !== id)
    await persist()
  }

  /** 删除某个实体相关的全部关联 */
  async function removeEntity(ref: EntityRef): Promise<void> {
    links.value = links.value.filter(
      (l) => !(l.from.kind === ref.kind && l.from.id === ref.id) && !(l.to.kind === ref.kind && l.to.id === ref.id)
    )
    await persist()
  }

  /** 与某实体相邻的所有关联 */
  function neighborsOf(ref: EntityRef): Link[] {
    return links.value.filter(
      (l) =>
        (l.from.kind === ref.kind && l.from.id === ref.id) ||
        (l.to.kind === ref.kind && l.to.id === ref.id)
    )
  }

  /** 与某实体相连的其它实体 */
  function connectedTo(ref: EntityRef): EntityRef[] {
    const out: EntityRef[] = []
    for (const l of neighborsOf(ref)) {
      const other =
        l.from.kind === ref.kind && l.from.id === ref.id
          ? l.to
          : l.from
      out.push(other)
    }
    return out
  }

  return { links, load, persist, add, remove, removeEntity, neighborsOf, connectedTo }
})
