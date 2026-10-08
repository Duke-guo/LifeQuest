import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dataApi } from '../services/data'
import type { Settings } from '../../../shared/types'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings | null>(null)

  async function load(): Promise<void> {
    settings.value = await dataApi.readSettings()
  }

  async function save(): Promise<void> {
    if (settings.value) await dataApi.writeSettings(settings.value)
  }

  return { settings, load, save }
})
