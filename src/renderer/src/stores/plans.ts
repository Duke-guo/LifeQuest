import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dataApi } from '../services/data'
import type { Plan, PlansFile } from '../../../shared/types'
import { uid } from '../utils/helpers'

export const usePlansStore = defineStore('plans', () => {
  const plans = ref<Plan[]>([])

  async function load(): Promise<void> {
    const file = await dataApi.readPlans()
    plans.value = file?.plans ?? []
  }

  async function persist(): Promise<void> {
    const file: PlansFile = { schemaVersion: 1, plans: plans.value }
    await dataApi.writePlans(file)
  }

  async function create(input: {
    title: string
    start: string
    end: string
    notes: string
  }): Promise<void> {
    const plan: Plan = {
      schemaVersion: 1,
      id: uid(),
      title: input.title,
      start: input.start,
      end: input.end,
      seasonId: null,
      notes: input.notes,
      taskIds: []
    }
    plans.value.push(plan)
    await persist()
  }

  async function remove(id: string): Promise<void> {
    plans.value = plans.value.filter((p) => p.id !== id)
    await persist()
  }

  return { plans, load, persist, create, remove }
})
