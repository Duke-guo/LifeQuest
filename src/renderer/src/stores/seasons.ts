import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dataApi } from '../services/data'
import type { Season, SeasonsFile, SeasonType } from '../../../shared/types'
import { uid, todayStr } from '../utils/helpers'

export type SeasonPhase = '进行中' | '未开始' | '已结束'

export function derivePhase(start: string, end: string): SeasonPhase {
  const today = todayStr()
  if (today < start) return '未开始'
  if (today > end) return '已结束'
  return '进行中'
}

export const useSeasonsStore = defineStore('seasons', () => {
  const seasons = ref<Season[]>([])

  async function load(): Promise<void> {
    const file = await dataApi.readSeasons()
    seasons.value = file?.seasons ?? []
  }

  async function persist(): Promise<void> {
    const file: SeasonsFile = { schemaVersion: 1, seasons: seasons.value }
    await dataApi.writeSeasons(file)
  }

  async function create(input: {
    name: string
    type: SeasonType
    start: string
    end: string
    categories: string[]
  }): Promise<void> {
    const phase = derivePhase(input.start, input.end)
    const status = phase === '已结束' ? 'archived' : phase === '未开始' ? 'planned' : 'active'
    const season: Season = {
      id: uid(),
      name: input.name,
      type: input.type,
      start: input.start,
      end: input.end,
      status,
      categories: input.categories
    }
    seasons.value.push(season)
    await persist()
  }

  async function remove(id: string): Promise<void> {
    seasons.value = seasons.value.filter((s) => s.id !== id)
    await persist()
  }

  return { seasons, load, persist, create, remove }
})
