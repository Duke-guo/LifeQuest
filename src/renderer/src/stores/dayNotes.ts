import { defineStore } from 'pinia'
import { ref } from 'vue'
import { dataApi } from '../services/data'
import type { DayNote, DayNotesFile, DayPhaseOverride } from '../../../shared/types'

/** 每日标签：用户可以自己写「忙不忙」、自己指定当天性质，留空则用算法默认值 */
export const useDayNotesStore = defineStore('dayNotes', () => {
  const days = ref<DayNote[]>([])
  const loaded = ref(false)

  async function load(): Promise<void> {
    const file = await dataApi.readDayNotes()
    days.value = file?.days ?? []
    loaded.value = true
  }

  async function persist(): Promise<void> {
    const file: DayNotesFile = { schemaVersion: 1, days: days.value }
    await dataApi.writeDayNotes(file)
  }

  function on(date: string): DayNote | undefined {
    return days.value.find((d) => d.date === date)
  }

  /** 用户自定义的忙碌标签（空字符串也会被保留，表示"就是要空着"） */
  function busyOf(date: string): string | undefined {
    return on(date)?.busy
  }

  /** 用户手动指定的当天性质；没设过或设为 auto 时由校历推算 */
  function phaseOf(date: string): DayPhaseOverride | undefined {
    const p = on(date)?.phase
    return p && p !== 'auto' ? p : undefined
  }

  /** 被手动标成「放假」的日子：这些天不排课 */
  function manualHolidays(): Set<string> {
    return new Set(
      days.value.filter((d) => d.phase === 'holiday').map((d) => d.date)
    )
  }

  async function setBusy(date: string, busy: string): Promise<void> {
    const found = on(date)
    if (found) {
      found.busy = busy
    } else {
      days.value.push({ date, busy })
    }
    await persist()
  }

  async function setPhase(date: string, phase: DayPhaseOverride): Promise<void> {
    const found = on(date)
    if (found) {
      found.phase = phase
    } else {
      days.value.push({ date, phase })
    }
    await persist()
  }

  async function setNote(date: string, note: string): Promise<void> {
    const found = on(date)
    if (found) {
      found.note = note
    } else {
      days.value.push({ date, note })
    }
    await persist()
  }

  return {
    days,
    loaded,
    load,
    persist,
    on,
    busyOf,
    phaseOf,
    manualHolidays,
    setBusy,
    setPhase,
    setNote
  }
})
