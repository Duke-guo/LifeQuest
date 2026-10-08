import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dataApi } from '../services/data'
import type { Semester, SemesterFile, SemesterHoliday } from '../../../shared/types'
import { uid, toDateStr } from '../utils/helpers'

function emptySemester(): Semester {
  const today = new Date()
  return {
    schemaVersion: 1,
    name: '本学期',
    start: toDateStr(today),
    teachingEnd: toDateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7 * 16)),
    examStart: '',
    examEnd: '',
    holidays: []
  }
}

/** 某天在学期中的角色 */
export type DayPhase = 'before' | 'class' | 'exam' | 'holiday' | 'weekend' | 'after' | 'unknown'

/** 一律按本地时区解析（new Date('2026-10-15') 会按 UTC 解析，导致差 8 小时） */
function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return toDateStr(new Date(y, m - 1, d + n))
}

function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const t1 = new Date(ay, am - 1, ad).getTime()
  const t2 = new Date(by, bm - 1, bd).getTime()
  return Math.round((t1 - t2) / 86400000)
}

export const useSemesterStore = defineStore('semester', () => {
  const semester = ref<Semester>(emptySemester())
  const loaded = ref(false)

  async function load(): Promise<void> {
    const file = await dataApi.readSemester()
    semester.value = file ?? emptySemester()
    loaded.value = true
  }

  async function persist(): Promise<void> {
    const file: SemesterFile = JSON.parse(JSON.stringify(semester.value))
    await dataApi.writeSemester(file)
  }

  async function save(): Promise<void> {
    await persist()
  }

  /** 上学日（第 1 周周一） */
  const start = computed(() => semester.value.start)
  const teachingEnd = computed(() => semester.value.teachingEnd)

  /** 停课日期集合 */
  const noClassDates = computed(() => {
    const set = new Set<string>()
    for (const h of semester.value.holidays) {
      if (!h.noClass || !h.start) continue
      const end = h.end || h.start
      let cur = h.start
      let guard = 0
      while (cur <= end && guard < 400) {
        set.add(cur)
        cur = addDaysIso(cur, 1)
        guard++
      }
    }
    return set
  })

  /** 第几周（开学日为第 1 周周一）；不在学期内返回 null */
  function weekOf(date: string): number | null {
    const s = semester.value.start
    if (!s || date < s) return null
    return Math.floor(diffDays(date, s) / 7) + 1
  }

  /** 某天的角色：开学前 / 上课 / 考试 / 放假 / 周末 / 学期结束
   *  @param hasEvents 当天是否有实际安排（周末有课时仍标为上课） */
  function phaseOf(date: string, hasEvents = false): DayPhase {
    const sem = semester.value
    if (!sem.start) return 'unknown'
    if (date < sem.start) return 'before'
    if (noClassDates.value.has(date)) return 'holiday'
    if (sem.examStart && sem.examEnd && date >= sem.examStart && date <= sem.examEnd) return 'exam'
    if (date <= sem.teachingEnd) {
      const wd = parseLocal(date).getDay()
      const isWeekend = wd === 0 || wd === 6
      if (isWeekend && !hasEvents) return 'weekend'
      return 'class'
    }
    if (sem.examEnd && date <= sem.examEnd) return 'exam'
    return 'after'
  }

  function holidayOn(date: string): SemesterHoliday | undefined {
    return semester.value.holidays.find((h) => date >= h.start && date <= (h.end || h.start))
  }

  async function addHoliday(h: { name: string; start: string; end: string; noClass: boolean }): Promise<void> {
    semester.value.holidays.push({ id: uid(), ...h })
    await persist()
  }

  async function removeHoliday(id: string): Promise<void> {
    semester.value.holidays = semester.value.holidays.filter((h) => h.id !== id)
    await persist()
  }

  async function reset(data: Partial<Semester>): Promise<void> {
    semester.value = { ...emptySemester(), ...data, schemaVersion: 1 }
    await persist()
  }

  return {
    semester,
    loaded,
    start,
    teachingEnd,
    noClassDates,
    load,
    persist,
    save,
    weekOf,
    phaseOf,
    holidayOn,
    addHoliday,
    removeHoliday,
    reset
  }
})
