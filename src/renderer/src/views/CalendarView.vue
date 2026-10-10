<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useTasksStore } from '../stores/tasks'
import { usePlansStore } from '../stores/plans'
import { useJournalIndexStore } from '../stores/journalIndex'
import { useSemesterStore } from '../stores/semester'
import { useDayNotesStore } from '../stores/dayNotes'
import { useConfirmStore } from '../stores/confirm'
import {
  eventsFromTasks,
  eventsFromPlans,
  summarizeWeek,
  eventHours,
  WEATHER_META,
  MOOD_META
} from '../utils/schedule'
import { toDateStr } from '../utils/helpers'
import { computeDayColor, busyTier, type DayColor } from '../utils/dayColor'
import { noteFromTask } from '../utils/noteActions'
import { nextOccurrence, deadlinePressure, deadlineTimeOf } from '../utils/schedule'
import { computeDayGrade, GRADE_TITLE, type DayGrade } from '../utils/dayGrade'
import AppIcon from '../components/AppIcon.vue'
import TaskItem from '../components/TaskItem.vue'
import JournalVine from '../components/JournalVine.vue'
import TaskEditModal from '../components/TaskEditModal.vue'
import AddHistory from '../components/AddHistory.vue'
import type { CalendarEvent, Task, DayPhaseOverride } from '../../../shared/types'

const emit = defineEmits<{ openJournal: [date: string]; openNote: [id: string]; openCalendar: [date: string, mode?: 'day' | 'week', taskId?: string] }>()
const props = defineProps<{ focusDate?: string; focusMode?: 'day' | 'week'; focusTaskId?: string }>()

/** 定位过来的那条任务高亮几秒 */
const flashId = ref<string | null>(null)
let flashTimer = 0

const tasksStore = useTasksStore()
const plansStore = usePlansStore()
const journalIndex = useJournalIndexStore()
const semesterStore = useSemesterStore()
const dayNotes = useDayNotesStore()
const confirm = useConfirmStore()

type Mode = 'day' | 'week' | 'month'
const mode = ref<Mode>('week')
const cursor = ref(new Date())
const editing = ref<Task | null>(null)

// 日视图侧边栏：快速新增
const newTitle = ref('')
const newStart = ref('09:00')
const newEnd = ref('10:00')
const newImp = ref(3)

// 日视图侧边栏：当天标签（忙碌程度由用户自己写）
const busyInput = ref('')

onMounted(async () => {
  if (!tasksStore.loaded) await tasksStore.load()
  await plansStore.load()
  await journalIndex.load()
  await semesterStore.load()
  await dayNotes.load()
  if (props.focusDate) {
    const [fy, fm, fd] = props.focusDate.split('-').map(Number)
    cursor.value = new Date(fy, fm - 1, fd)
    mode.value = props.focusMode ?? 'day'
  }
  if (props.focusTaskId) {
    flashId.value = props.focusTaskId
    flashTimer = window.setTimeout(() => (flashId.value = null), 4200)
  }
})

onUnmounted(() => {
  window.clearTimeout(flashTimer)
  cancelAnimationFrame(rafId)
})

onMounted(() => {
  rafId = requestAnimationFrame(tick)
  measureFlagBand()
  // 字体异步加载、后续滚动条出现等都会改动表头高度：低频轮询量一次（每 30 帧）
  // 换周/换模式后表头文案也会变，一并重量
  watch([mode, () => weekDays.value[0]], () => measureFlagBand())
})

const today = toDateStr(new Date())
const year = computed(() => cursor.value.getFullYear())
const month = computed(() => cursor.value.getMonth())
const cursorIso = computed(() => toDateStr(cursor.value))

// 切换日期时，同步「当天标签」输入框
watch(
  cursorIso,
  (d) => {
    busyInput.value = dayNotes.busyOf(d) ?? ''
  },
  { immediate: true }
)

const visibleRange = computed<[string, string]>(() => {
  if (mode.value === 'day') return [cursorIso.value, cursorIso.value]
  if (mode.value === 'week') return [weekDays.value[0], weekDays.value[6]]
  const first = toDateStr(new Date(year.value, month.value, 1))
  const last = toDateStr(new Date(year.value, month.value + 1, 0))
  return [first, last]
})

/** 手动标成「放假」的日子也参与停课 */
const skipDates = computed(() => {
  const s = new Set<string>(semesterStore.noClassDates)
  for (const d of dayNotes.manualHolidays()) s.add(d)
  return s
})

const events = computed<CalendarEvent[]>(() => {
  const [s, e] = visibleRange.value
  return [
    ...eventsFromTasks(tasksStore.tasks, s, e, skipDates.value),
    ...eventsFromPlans(plansStore.plans)
  ]
})

function eventsOn(date: string): CalendarEvent[] {
  return events.value
    .filter((e) => e.date === date)
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
}

/** 当天实际发生的任务（含重复日程展开出来的那一次）；已完成的保留显示 */
const dayTasks = computed(() => {
  const ids = new Set(eventsOn(cursorIso.value).map((e) => e.refId))
  return tasksStore.tasks
    .filter((t) => ids.has(t.id))
    .sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1
      if (b.status === 'done' && a.status !== 'done') return -1
      return (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99')
    })
})

// ---------- 忙碌程度：算法只提供「默认值」，用户可自己写 ----------
function loadScore(date: string): number {
  return eventsOn(date).reduce((s, e) => s + eventHours(e), 0)
}

/** 算法默认档位（按当天安排的总时长；阈值统一在 utils/dayColor.ts） */
function autoLabel(date: string): string {
  return busyTier(loadScore(date), eventsOn(date).length, deadlinePressure(eventsOn(date), today))
}

/** 周视图：所有列等高，整块用一条连续曲线裁出光滑下边缘；卡片之间留空隙、带圆角 */
const WEEK_COL_H = 312
const WEEK_FLAT = 0.84
function weekCurveY(x: number, center: number | null): number {
  if (center === null) return WEEK_FLAT
  const k = (x - center) / 0.34
  return WEEK_FLAT + (1 - WEEK_FLAT) * Math.exp(-k * k)
}

/** 曲线最低点：悬停时连续跟随鼠标（rAF 平滑），没悬停时本周=今天、非本周=拉平 */
const hoverDay = ref<number | null>(null)
const targetCenter = ref<number | null>(null)
const smoothCenter = ref<number | null>(null)

function onWeekMove(e: MouseEvent): void {
  const wrap = e.currentTarget as HTMLElement
  const rect = wrap.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  targetCenter.value = Math.max(0, Math.min(1, x))
  hoverDay.value = Math.max(0, Math.min(6, Math.floor(x * 7)))
}

function onWeekLeave(): void {
  targetCenter.value = null
  hoverDay.value = null
}

let rafId = 0
let bandTick = 0
function tick(): void {
  const t = targetCenter.value
  const s = smoothCenter.value
  if (t === null) {
    smoothCenter.value = null
  } else if (s === null) {
    smoothCenter.value = t
  } else {
    smoothCenter.value = s + (t - s) * 0.2
    if (Math.abs(t - s) < 0.0004) smoothCenter.value = t
  }
  // 每 30 帧（约半秒）复核一次旗标区间上沿，兼顾字体迟到、滚动条出现等布局变化
  if (++bandTick >= 30) {
    bandTick = 0
    measureFlagBand()
    measureRowBands()
  }
  rafId = requestAnimationFrame(tick)
}

const curveCenter = computed<number | null>(() => {
  if (smoothCenter.value !== null) return smoothCenter.value
  const ti = weekDays.value.indexOf(today)
  return ti < 0 ? null : (ti + 0.5) / 7
})

/** 整块网格的裁剪路径（objectBoundingBox 坐标，一条光滑曲线） */
const weekClipPath = computed(() => {
  const center = curveCenter.value
  const N = 56
  const y = (x: number): string => weekCurveY(x, center).toFixed(4)
  const pts: string[] = [`M 0 -0.4`, `L 1 -0.4`]
  if (center === null) {
    pts.push(`L 1 ${WEEK_FLAT}`, `L 0 ${WEEK_FLAT}`)
  } else {
    pts.push(`L 1 ${y(1)}`)
    for (let i = N - 1; i >= 0; i--) pts.push(`L ${(i / N).toFixed(4)} ${y(i / N)}`)
  }
  pts.push('Z')
  return pts.join(' ')
})

/** 旗标的可插区间上沿：这一列的日程文字起始处（表头/性质条之下），实测得到 */
const eventsRefs = ref<HTMLElement[]>([])
const flagBandTop = ref(104)
function measureFlagBand(): void {
  const list = eventsRefs.value
  if (!list || !list.length) return
  let t = 0
  for (const el of list) {
    if (!el || !el.isConnected) continue
    const v = el.offsetTop || 0
    if (v > t) t = v
  }
  if (t > 0 && Math.abs(t - flagBandTop.value) > 0.5) flagBandTop.value = t
}

/** 这一列要插的旗子（按时间排序），供模板与落点计算共用 */
const weekFlags = computed<DeadlineFlag[][]>(() => weekDays.value.map((d) => flagsOn(d)))

/** 同一列里旗子的竖直落点（像素）：按时间排好后，太近的往下错开，整体不越过曲线 */
const FLAG_GAP = 24
function flagTops(list: DeadlineFlag[], i: number): number[] {
  const visibleH = weekCurveY((i + 0.5) / 7, curveCenter.value) * WEEK_COL_H
  const top = Math.min(flagBandTop.value, Math.max(24, visibleH - 40))
  const bottom = Math.max(top + 20, visibleH - 14)
  const n = list.length
  const gap = n > 1 ? Math.min(FLAG_GAP, Math.max(16, (bottom - top) / (n - 1))) : 0
  const out: number[] = []
  for (let k = 0; k < n; k++) {
    const wanted = top + list[k].pos * (bottom - top)
    const minY = k === 0 ? top : out[k - 1] + gap
    out.push(Math.max(minY, Math.min(wanted, bottom)))
  }
  const over = n ? out[n - 1] - bottom : 0
  if (over > 0) for (let k = 0; k < n; k++) out[k] = Math.max(top, out[k] - over)
  return out
}

function flagTopAt(i: number, fi: number): string {
  return Math.round(flagTops(weekFlags.value[i] ?? [], i)[fi] ?? flagBandTop.value) + 'px'
}

/**
 * 旗子正好落在一行文字上时，只留小旗、把时刻收起来（鼠标移到这一列再展开）——
 * 和日视图时间轴「重叠就只画一条线」是同一个原则，避免把日程文字盖掉。
 */
function flagCompact(i: number, fi: number): boolean {
  if (hoverDay.value === i) return false
  const t = flagTops(weekFlags.value[i] ?? [], i)[fi]
  if (t === undefined) return false
  const bands = rowBands.value[i] ?? []
  return bands.some(([a, b]) => t > a - 10 && t < b + 10)
}

/** 每列里文字行占用的竖直区间（相对列顶），用来判断旗子会不会压在文字上 */
const rowBands = ref<Record<number, [number, number][]>>({})
function measureRowBands(): void {
  const list = eventsRefs.value
  if (!list || !list.length) return
  const map: Record<number, [number, number][]> = {}
  list.forEach((el, i) => {
    if (!el || !el.isConnected) return
    const bands: [number, number][] = []
    for (const c of Array.from(el.children)) {
      if (!c.classList.contains('dot')) continue
      const r = c as HTMLElement
      bands.push([r.offsetTop, r.offsetTop + r.offsetHeight])
    }
    map[i] = bands
  })
  rowBands.value = map
}

/** 这一天的截止型事项（画成插入旗标） */
interface DeadlineFlag {
  id: string
  title: string
  /** 落点时刻 HH:mm（24:00 = 当天结束） */
  time: string
  done: boolean
  /** 落点在柱状里的比例 0..1 */
  pos: number
}

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function flagsOn(date: string): DeadlineFlag[] {
  const out: DeadlineFlag[] = []
  for (const e of eventsOn(date)) {
    if (!e.meta?.deadline) continue
    const t = tasksStore.tasks.find((x) => x.id === e.refId)
    const time = deadlineTimeOf(e, t)
    // 06:00–24:00 映射到列的可用高度
    const frac = (toMin(time) / 60 - 6) / 18
    out.push({
      id: e.id,
      title: e.title,
      time,
      done: e.meta.status === 'done',
      pos: Math.max(0.04, Math.min(0.97, frac))
    })
  }
  out.sort((a, b) => a.pos - b.pos)
  return out
}

/** 显示用的标签：用户写过就用用户的 */
function busyLabel(date: string): string {
  const custom = dayNotes.busyOf(date)
  if (custom !== undefined && custom !== '') return custom
  return autoLabel(date)
}

function busyClass(date: string): string {
  if (dayNotes.busyOf(date)) return 'b-custom'
  return 'b-auto'
}

/** 每天的颜色：色相=忙碌程度，饱和度=心情，明度=天气 */
function colorOf(date: string): DayColor {
  const j = journalIndex.on(date)
  return computeDayColor(date, loadScore(date), eventsOn(date).length, j?.mood, j?.weather)
}

async function saveBusy(): Promise<void> {
  await dayNotes.setBusy(cursorIso.value, busyInput.value.trim())
}

async function useAutoBusy(): Promise<void> {
  busyInput.value = ''
  await dayNotes.setBusy(cursorIso.value, '')
}

const PHASE_LABEL: Record<string, string> = {
  class: '上课',
  exam: '考试',
  holiday: '放假',
  weekend: '周末',
  // 学期外的日期不写死结论，留一个空白位，等排好下一学期再定
  before: '',
  after: '',
  none: '',
  custom: '',
  unknown: ''
}

const PHASE_CLASS: Record<string, string> = {
  class: 'p-class',
  exam: 'p-exam',
  holiday: 'p-holiday',
  weekend: 'p-weekend',
  before: 'p-blank',
  after: 'p-blank',
  none: 'p-blank',
  custom: 'p-custom',
  unknown: 'p-blank'
}

/** 手动指定的性质优先，其次按校历推算 */
function dayPhase(date: string): string {
  const manual = dayNotes.phaseOf(date)
  if (manual && manual !== 'custom') return manual
  if (manual === 'custom') return 'custom'
  return semesterStore.phaseOf(date, eventsOn(date).length > 0)
}

/** 格子里显示的性质文字：自定义 > 校历假期名 > 内置名 */
function phaseText(date: string): string {
  return dayNotes.customLabelOf(date) ?? semesterStore.holidayOn(date)?.name ?? PHASE_LABEL[dayPhase(date)]
}

/** 这天性质的选择项（日视图里可改；最后一格是自定义） */
const PHASE_OPTIONS: Array<{ key: DayPhaseOverride; label: string }> = [
  { key: 'auto', label: '自动' },
  { key: 'class', label: '上课' },
  { key: 'weekend', label: '周末' },
  { key: 'holiday', label: '放假（停课）' },
  { key: 'exam', label: '考试' },
  { key: 'none', label: '空白' },
  { key: 'custom', label: '自定义…' }
]

/** 每天完成的等级评价：只评「今天及以前」，未来的事不预判 */
function gradeOf(date: string): DayGrade | null {
  if (date > today) return null
  return computeDayGrade(eventsOn(date), journalIndex.on(date))
}

function gradeTitle(date: string): string {
  const g = gradeOf(date)
  if (!g) return ''
  const pct = Math.round(g.score * 100)
  return g.grade + ' 级 · 完成度 ' + pct + '% · ' + GRADE_TITLE[g.grade]
}

const customPhase = ref('')
/** 「自定义…」被点开后，显示输入框 */
const showCustomPhase = ref(false)
const customInput = ref<HTMLInputElement | null>(null)

async function setPhase(p: DayPhaseOverride): Promise<void> {
  if (p === 'custom') {
    // 打开输入框，等用户敲字
    customPhase.value = dayNotes.customLabelOf(cursorIso.value) ?? ''
    showCustomPhase.value = true
    await nextTick()
    customInput.value?.focus()
    return
  }
  showCustomPhase.value = false
  await dayNotes.setPhase(cursorIso.value, p)
  await tasksStore.load()
}

async function saveCustomPhase(): Promise<void> {
  await dayNotes.setPhaseLabel(cursorIso.value, customPhase.value)
  showCustomPhase.value = false
  await tasksStore.load()
}

/** 周横幅底色：取本周 7 天的配色做渐变，改心情/天气会跟着变 */
const weekGradient = computed(() => {
  const days = weekDays.value
  if (!days.length) return ''
  const cols = days.map((d) => colorOf(d).bg)
  const stops = cols
    .map((c, i) => `${c} ${Math.round((i / Math.max(1, cols.length - 1)) * 100)}%`)
    .join(', ')
  return `linear-gradient(90deg, ${stops})`
})

/** 当前视图内每天的颜色，按日期索引（避免模板里重复计算） */
const colorMap = computed<Record<string, DayColor>>(() => {
  const map: Record<string, DayColor> = {}
  if (mode.value === 'month') {
    for (const c of monthCells.value) if (c.inMonth) map[c.date] = colorOf(c.date)
  } else if (mode.value === 'week') {
    for (const d of weekDays.value) map[d] = colorOf(d)
  }
  return map
})

// ---------- 月视图 ----------
const monthCells = computed(() => {
  const first = new Date(year.value, month.value, 1)
  const pad = first.getDay()
  const days = new Date(year.value, month.value + 1, 0).getDate()
  const list: Array<{ date: string; day: number; inMonth: boolean }> = []
  for (let i = 0; i < pad; i++) list.push({ date: '', day: 0, inMonth: false })
  for (let d = 1; d <= days; d++) {
    list.push({ date: toDateStr(new Date(year.value, month.value, d)), day: d, inMonth: true })
  }
  return list
})

// ---------- 周视图 ----------
const weekStart = computed(() => {
  const d = new Date(cursor.value)
  d.setDate(d.getDate() - d.getDay())
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
})

const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.value.getFullYear(), weekStart.value.getMonth(), weekStart.value.getDate() + i)
    return toDateStr(d)
  })
)

const weekSummary = computed(() =>
  summarizeWeek(tasksStore.tasks, weekStart.value, skipDates.value)
)

const TAG_CLASS: Record<string, string> = {
  考试周: 'tag-exam',
  忙碌周: 'tag-busy',
  轻松周: 'tag-easy',
  放假周: 'tag-holiday',
  普通周: 'tag-normal'
}

// ---------- 日视图时间轴 ----------
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6)

function topOf(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return ((h - 6) * 60 + (m || 0)) * (56 / 60)
}

function heightOf(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = eh * 60 + (em || 0) - (sh * 60 + (sm || 0))
  return Math.max(26, mins * (56 / 60))
}

const daySchedules = computed(() => eventsOn(cursorIso.value).filter((e) => e.kind === 'schedule' && e.time))

// ---------- 导航 ----------
function shift(delta: number): void {
  const d = new Date(cursor.value)
  if (mode.value === 'day') d.setDate(d.getDate() + delta)
  else if (mode.value === 'week') d.setDate(d.getDate() + delta * 7)
  else d.setMonth(d.getMonth() + delta)
  cursor.value = new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** 滚轮切换：稍微快一点滚动就翻页（带滑入动画） */
const animKey = ref(0)
const slideDir = ref<'next' | 'prev'>('next')
let wheelAcc = 0
let wheelLockUntil = 0
let wheelResetTimer: number | undefined

function onWheel(e: WheelEvent): void {
  if (Math.abs(e.deltaY) < 1) return
  const now = Date.now()
  if (now < wheelLockUntil) return

  wheelAcc += e.deltaY
  if (wheelResetTimer) window.clearTimeout(wheelResetTimer)
  wheelResetTimer = window.setTimeout(() => (wheelAcc = 0), 180)

  if (Math.abs(wheelAcc) >= 40) {
    const dir = wheelAcc > 0 ? 1 : -1
    wheelAcc = 0
    wheelLockUntil = now + 380
    slideDir.value = dir > 0 ? 'next' : 'prev'
    shift(dir)
    animKey.value++
  }
}

const slideClass = computed(() => (slideDir.value === 'next' ? 'slide-next' : 'slide-prev'))

function goToday(): void {
  cursor.value = new Date()
}

function drillTo(date: string): void {
  const [y, m, d] = date.split('-').map(Number)
  cursor.value = new Date(y, m - 1, d)
  mode.value = 'day'
}

const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六']

/** 'YYYY-MM-DD' → 一二三四五六日（本地时间） */
function weekdayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return WEEKDAY_CN[new Date(y, m - 1, d).getDay()]
}

const title = computed(() => {
  if (mode.value === 'day') {
    const [y, m, d] = cursorIso.value.split('-').map(Number)
    return `${y} 年 ${m} 月 ${d} 日 · 星期${WEEKDAY_CN[new Date(y, m - 1, d).getDay()]}`
  }
  if (mode.value === 'week') return `${weekSummary.value.start} ~ ${weekSummary.value.end}`
  return `${year.value} 年 ${month.value + 1} 月`
})

// ---------- 日视图侧边栏：增删改 ----------
async function quickAdd(): Promise<void> {
  const t = newTitle.value.trim()
  if (!t) return
  await tasksStore.addTask({
    title: t,
    type: 'daily',
    kind: 'schedule',
    importance: newImp.value,
    due: cursorIso.value,
    startTime: newStart.value,
    endTime: newEnd.value,
    remindMinutes: 15
  })
  newTitle.value = ''
}

async function toggleTask(t: Task): Promise<void> {
  await tasksStore.setStatus(t.id, t.status === 'done' ? 'todo' : 'done')
}

/** 一键为这天的这节课写笔记（会自动关联，并出现在葡萄藤对应学科上） */
async function writeNote(t: Task): Promise<void> {
  const id = await noteFromTask(t, cursorIso.value)
  emit('openNote', id)
}

async function removeTask(t: Task): Promise<void> {
  const ok = await confirm.ask({
    title: '删除这件事？',
    message: `「${t.title}」`,
    detail: '删掉后可以在任务页「历史添加」里一键找回。',
    confirmText: '删除'
  })
  if (!ok) return
  await tasksStore.removeTask(t.id)
}

/** 从日视图里的条目跳到它所在的那一周 */
function locate(t: Task): void {
  const date = nextOccurrence(t, today, skipDates.value) ?? t.due
  if (date) emit('openCalendar', date, 'week', t.id)
}
</script>

<template>
  <div class="calendar-view">
    <header class="view-head cal-head">
      <div class="ch-left">
        <h2>日历</h2>
        <p class="sub">任务 · 日程 · 计划 · 日记，一处聚合</p>
      </div>

      <!-- 日期放在页面正中 -->
      <div class="nav">
        <button @click="shift(-1)">‹</button>
        <span class="label">{{ title }}</span>
        <button @click="shift(1)">›</button>
      </div>

      <div class="ch-right">
        <div class="modes">
          <button :class="{ on: mode === 'day' }" @click="mode = 'day'">日</button>
          <button :class="{ on: mode === 'week' }" @click="mode = 'week'">周</button>
          <button :class="{ on: mode === 'month' }" @click="mode = 'month'">月</button>
        </div>
        <button class="today-btn" @click="goToday">今天</button>
      </div>
    </header>

    <!-- ========== 月视图（只显示概括，不堆文字） ========== -->
    <template v-if="mode === 'month'">
      <div class="weekdays">
        <span v-for="w in ['日', '一', '二', '三', '四', '五', '六']" :key="w">{{ w }}</span>
      </div>
      <div class="grid" :key="`m${animKey}`" :class="slideClass" @wheel.prevent="onWheel">
        <div
          v-for="(c, i) in monthCells"
          :key="i"
          class="cell"
          :class="{ empty: !c.inMonth, today: c.date === today }"
          :style="c.inMonth ? { background: colorMap[c.date]?.bg } : undefined"
          @click="c.inMonth && drillTo(c.date)"
        >
          <template v-if="c.inMonth">
            <span
              v-if="gradeOf(c.date)"
              class="grade"
              :class="`g-${gradeOf(c.date)!.grade}`"
              :title="gradeTitle(c.date)"
            >
              {{ gradeOf(c.date)!.grade }}
            </span>
            <div class="cell-head">
              <span class="day">{{ c.day }}</span>
              <span class="wk">第{{ semesterStore.weekOf(c.date) }}周</span>
            </div>
            <div class="cell-mid">
              <span
                class="busy"
                :class="busyClass(c.date)"
                :style="
                  dayNotes.busyOf(c.date)
                    ? undefined
                    : { background: colorMap[c.date]?.chipBg, color: colorMap[c.date]?.chipFg }
                "
              >
                {{ busyLabel(c.date) }}
                <template v-if="eventsOn(c.date).length">· {{ eventsOn(c.date).length }}</template>
              </span>
              <span class="icons">
                <span
                  v-if="journalIndex.on(c.date)?.weather"
                  class="ico"
                  :style="{ color: WEATHER_META[journalIndex.on(c.date)!.weather!].color }"
                  :title="WEATHER_META[journalIndex.on(c.date)!.weather!].label"
                >
                  <AppIcon :name="journalIndex.on(c.date)!.weather!" :size="13" />
                </span>
                <span
                  v-if="journalIndex.on(c.date)?.mood"
                  class="ico"
                  :style="{ color: MOOD_META[journalIndex.on(c.date)!.mood!].color }"
                  :title="MOOD_META[journalIndex.on(c.date)!.mood!].label"
                >
                  <AppIcon :name="`mood-${journalIndex.on(c.date)!.mood}`" :size="13" />
                </span>
              </span>
            </div>
            <div class="phase-bar" :class="PHASE_CLASS[dayPhase(c.date)]">
              {{ phaseText(c.date) }}
            </div>
          </template>
        </div>
      </div>

      <!-- 说明：点格子进日视图，文字细节都在那里 -->
      <p class="month-tip">
        滚轮可快速翻月 · 点任意格子进入<b>日视图</b>：那里能查看、修改、新增当天的每一项安排，并调整重要程度。
      </p>
    </template>

    <!-- ========== 周视图 ========== -->
    <template v-else-if="mode === 'week'">
      <div class="week-banner" :class="TAG_CLASS[weekSummary.tag]" :style="{ background: weekGradient }">
        <span class="wb-tag">{{ weekSummary.tag }}</span>
        <span v-if="semesterStore.weekOf(weekSummary.start)" class="wb-week">
          第 {{ semesterStore.weekOf(weekSummary.start) }} 周
        </span>
        <span class="wb-meta">
          共 {{ weekSummary.taskCount }} 项 · 日程 {{ weekSummary.scheduleCount }} 个 · 合计
          {{ weekSummary.hours }} 小时 · 重要度合计 {{ weekSummary.score }}
        </span>
      </div>
      <div class="week-wrap" @mousemove="onWeekMove" @mouseleave="onWeekLeave">
      <svg class="week-clip-defs" aria-hidden="true"><defs><clipPath id="weekCurve" clipPathUnits="objectBoundingBox"><path :d="weekClipPath" /></clipPath></defs></svg>
      <div class="week-grid" :key="`w${animKey}`" :class="slideClass" @wheel.prevent="onWheel">
        <div
          v-for="(d, i) in weekDays"
          :key="d"
          class="week-col"
          :class="{ today: d === today, 'curve-peak': hoverDay === i }"
          :style="{ background: colorMap[d]?.bg }"
          :title="`点这里进日视图：可改这一天的性质、忙碌程度，并增删当天的安排`"
          @click="drillTo(d)"
        >
          <span
            v-if="gradeOf(d)"
            class="grade"
            :class="`g-${gradeOf(d)!.grade}`"
            :title="gradeTitle(d)"
          >
            {{ gradeOf(d)!.grade }}
          </span>
          <div class="wc-head">
            <span class="wc-wd">周{{ weekdayOf(d) }}</span>
            <span class="wc-date">{{ d.slice(5) }}</span>
          </div>

          <div class="wc-body">
            <span
              class="busy"
              :class="busyClass(d)"
              :style="
                dayNotes.busyOf(d)
                  ? undefined
                  : { background: colorMap[d]?.chipBg, color: colorMap[d]?.chipFg }
              "
            >
              {{ busyLabel(d) }}
            </span>
            <span class="wc-count">{{ eventsOn(d).length }} 项 · {{ Math.round(loadScore(d)) }}h</span>
            <span class="icons">
              <span
                v-if="journalIndex.on(d)?.weather"
                class="ico"
                :style="{ color: WEATHER_META[journalIndex.on(d)!.weather!].color }"
              >
                <AppIcon :name="journalIndex.on(d)!.weather!" :size="13" />
              </span>
              <span
                v-if="journalIndex.on(d)?.mood"
                class="ico"
                :style="{ color: MOOD_META[journalIndex.on(d)!.mood!].color }"
              >
                <AppIcon :name="`mood-${journalIndex.on(d)!.mood}`" :size="13" />
              </span>
            </span>
          </div>

          <div class="wc-phase" :class="PHASE_CLASS[dayPhase(d)]">
            {{ phaseText(d) }}
          </div>

          <div ref="eventsRefs" class="wc-events">
            <span
              v-for="e in eventsOn(d).slice(0, hoverDay === i ? 12 : 5)"
              :key="e.id"
              class="dot"
              :class="[`k-${e.kind}`, { flash: flashId && e.refId === flashId }]"
            >
              {{ e.time ? e.time + ' ' : '' }}{{ e.title }}
            </span>
            <span v-if="eventsOn(d).length > (hoverDay === i ? 12 : 5)" class="more">+{{ eventsOn(d).length - (hoverDay === i ? 12 : 5) }}</span>
          </div>
        </div>
      </div>

      <!-- 截止旗标单独一层：不受裁剪影响，绝不会被曲线切掉 -->
      <div class="week-flag-layer" :data-band="Math.round(flagBandTop)" :data-refs="eventsRefs.length">
        <div v-for="(d, i) in weekDays" :key="`f${d}`" class="flag-col">
          <span
            v-for="(f, fi) in weekFlags[i]"
            :key="f.id"
            class="flag"
            :class="{ done: f.done, compact: flagCompact(i, fi) }"
            :style="{ top: flagTopAt(i, fi) }"
            :title="`${f.done ? '已完成 · ' : '截止 '}${f.time === '24:00' ? '当天 24:00' : f.time} · ${f.title}`"
          >
            <i class="flag-pin"></i>
            <em class="flag-text">{{ f.done ? '已完成' : f.time === '24:00' ? '24:00' : f.time }}</em>
          </span>
        </div>
      </div>
      </div>

      <p class="month-tip">
        滚轮翻周 · 点任意一列进入<b>日视图</b>：可以改<b>这一天的性质</b>（上课 / 周末 / 放假停课 / 考试 / 空白）、
        增删当天安排、给每件事填上几点到几点，还能一键写这天的日记。
      </p>

      <!-- 横向的日记葡萄藤：串起本周每天的日记，滚轮切到周记 -->
      <JournalVine
        :week-start="weekSummary.start"
        :week-end="weekSummary.end"
        :days="weekDays"
        :colors="colorMap"
        @open-journal="(v: string) => emit('openJournal', v)"
        @open-note="(v: string) => emit('openNote', v)"
      />
    </template>

    <!-- ========== 日视图（左时间轴 + 右可编辑侧栏） ========== -->
    <template v-else>
      <div class="day-layout">
        <div class="timeline" :key="`d${animKey}`" :class="slideClass" @wheel.prevent="onWheel">
          <div v-for="h in HOURS" :key="h" class="hour-row">
            <span class="hour">{{ String(h).padStart(2, '0') }}:00</span>
          </div>
          <div
            v-for="e in daySchedules"
            :key="e.id"
            class="sched-block"
            :class="{ flash: flashId && e.refId === flashId }"
            :style="{ top: topOf(e.time!) + 'px', height: heightOf(e.time!, e.endTime ?? e.time!) + 'px' }"
          >
            <strong>{{ e.time }}–{{ e.endTime }}</strong> {{ e.title }}
            <em v-if="e.meta?.location">{{ e.meta.location }}</em>
          </div>

          <!-- 截止旗标：日中截止就挪到对应时刻 -->
          <span
            v-for="f in flagsOn(cursorIso)"
            :key="f.id"
            class="flag on-timeline"
            :class="{ done: f.done }"
            :style="{ top: topOf(f.time === '24:00' ? '23:59' : f.time) + 'px' }"
            :title="`${f.done ? '已完成 · ' : '截止 '}${f.time === '24:00' ? '当天 24:00' : f.time} · ${f.title}`"
          >
            <i class="flag-pin"></i>
            <em class="flag-text">{{ f.done ? '已完成' : f.title }}</em>
          </span>
        </div>

        <aside class="day-side">
          <!-- 当天安排：与任务页一致，可勾选 / 编辑 / 删除 / 调重要度 -->
          <div class="side-card">
            <div class="side-head">
              <h4>当天安排</h4>
              <span class="side-sub">{{ dayTasks.length }} 项</span>
            </div>

            <!-- 这天性质：可手动指定，放假还会自动停课 -->
            <div class="phase-edit">
              <span class="be-label">这天的性质</span>
              <div class="phase-opts">
                <button
                  v-for="o in PHASE_OPTIONS"
                  :key="o.key"
                  type="button"
                  class="phase-opt"
                  :class="{ on: (dayNotes.phaseOf(cursorIso) ?? 'auto') === o.key }"
                  @click="setPhase(o.key)"
                >
                  {{ o.label }}
                </button>
              </div>
              <span class="be-hint">
                现在：{{
                  dayNotes.customLabelOf(cursorIso)
                    ? `自定义「${dayNotes.customLabelOf(cursorIso)}」`
                    : dayNotes.phaseOf(cursorIso)
                      ? '手动指定'
                      : '按校历自动'
                }}
                · 「放假（停课）」当天不会排课
              </span>
              <div v-if="showCustomPhase" class="custom-phase">
                <input
                  ref="customInput"
                  v-model="customPhase"
                  class="be-input"
                  placeholder="这天的性质，比如：实习 / 运动会 / 回家"
                  @keyup.enter="saveCustomPhase"
                />
                <button class="be-clear" @click="saveCustomPhase">用这个名字</button>
                <button class="be-clear" @click="showCustomPhase = false">取消</button>
              </div>
            </div>

            <div class="busy-edit">
              <span class="be-label">忙碌程度</span>
              <input
                v-model="busyInput"
                class="be-input"
                :placeholder="`留空 = 按时间自动算（${autoLabel(cursorIso)}）`"
                @change="saveBusy"
              />
              <button v-if="dayNotes.busyOf(cursorIso)" class="be-clear" @click="useAutoBusy">用默认</button>
            </div>

            <div v-if="dayTasks.length === 0" class="none">这天还没有安排</div>
            <TaskItem
              v-for="t in dayTasks"
              :key="t.id"
              :task="t"
              :flash="flashId === t.id"
              @toggle="toggleTask(t)"
              @edit="editing = t"
              @remove="removeTask(t)"
              @note="writeNote(t)"
              @locate="locate(t)"
              @edit-child="editing = $event"
            />

            <div class="quick-add">
              <input v-model="newTitle" class="qa-title" placeholder="新增当天的安排…" @keyup.enter="quickAdd" />
              <div class="qa-row">
                <input v-model="newStart" type="time" />
                <span class="dash">–</span>
                <input v-model="newEnd" type="time" />
                <select v-model.number="newImp">
                  <option :value="5">★5</option>
                  <option :value="4">★4</option>
                  <option :value="3">★3</option>
                  <option :value="2">★2</option>
                  <option :value="1">★1</option>
                </select>
                <button class="qa-btn" @click="quickAdd">添加</button>
              </div>
              <AddHistory compact />
            </div>
          </div>

          <!-- 当日日记 -->
          <div class="side-card">
            <h4>当日日记</h4>
            <div v-if="journalIndex.on(cursorIso)" class="mood-row">
              <span
                v-if="journalIndex.on(cursorIso)!.weather"
                class="chip"
                :style="{ color: WEATHER_META[journalIndex.on(cursorIso)!.weather!].color }"
              >
                <AppIcon :name="journalIndex.on(cursorIso)!.weather!" :size="15" />
                {{ WEATHER_META[journalIndex.on(cursorIso)!.weather!].label }}
              </span>
              <span
                v-if="journalIndex.on(cursorIso)!.mood"
                class="chip"
                :style="{ color: MOOD_META[journalIndex.on(cursorIso)!.mood!].color }"
              >
                <AppIcon :name="`mood-${journalIndex.on(cursorIso)!.mood}`" :size="15" />
                {{ MOOD_META[journalIndex.on(cursorIso)!.mood!].label }}
              </span>
            </div>
            <p v-else class="none">这天还没有写日记</p>
            <button class="open-journal" @click="emit('openJournal', cursorIso)">
              {{ journalIndex.on(cursorIso) ? '打开这天的日记' : '去写这天的日记' }}
            </button>
          </div>
        </aside>
      </div>
    </template>

    <TaskEditModal v-if="editing" :task="editing" @close="editing = null" />
  </div>
</template>

<style scoped>
.controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
/* 页头三列：标题 | 日期（正中） | 视图切换 */
.cal-head {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
}
.ch-left {
  justify-self: start;
}
.ch-right {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.ch-right .today-btn {
  height: 30px;
  padding: 0 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 0.85rem;
}
.ch-right .today-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.modes {
  display: flex;
  background: var(--surface-2);
  border-radius: 10px;
  padding: 2px;
}
.modes button {
  border: none;
  background: none;
  padding: 0.35rem 0.8rem;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-2);
  font-size: 0.85rem;
}
.modes button.on {
  background: var(--surface);
  color: var(--accent);
  font-weight: 600;
}
.nav {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.nav button {
  min-width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.nav .today-btn {
  padding: 0 0.7rem;
}
.nav .label {
  font-family: var(--font-num);
  font-weight: 700;
  font-size: 1.5rem;
  min-width: 160px;
  text-align: center;
}

/* 月视图 */
.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  margin-bottom: 6px;
  text-align: center;
  color: var(--text-2);
  font-size: 0.8rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.cell {
  min-height: 92px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 6px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.cell:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
}
.cell.empty {
  background: transparent;
  border-color: transparent;
  cursor: default;
}
.cell.empty:hover {
  transform: none;
}
.cell.today {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.cell-head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 2.05rem;
}
.day {
  font-family: var(--font-num);
  font-size: 1.95rem;
  line-height: 1;
  color: var(--text);
  font-weight: 700;
}
.cell.today .day {
  color: var(--accent);
}
.wk {
  position: absolute;
  top: 0;
  right: 0;
  font-size: 0.66rem;
  color: var(--text-3);
  background: var(--surface-2);
  padding: 0 5px;
  border-radius: 5px;
}
.cell-mid {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  margin-top: 0.3rem;
}
.busy {
  font-size: 0.72rem;
  font-weight: 600;
  border-radius: 6px;
  padding: 1px 6px;
  /* 窄列里也要保持一行，否则「轻松」会被拆成上下两字 */
  white-space: nowrap;
  flex-shrink: 0;
}
/* 忙碌标签的颜色由算法注入（见 utils/dayColor.ts）；只有"用户自定义"用固定紫色区分 */
.b-auto {
  /* 颜色来自 :style */
}
.b-custom {
  background: rgba(155, 107, 217, 0.22);
  color: #7d52b8;
}
.icons {
  display: inline-flex;
  gap: 3px;
  flex-shrink: 0;
}
.ico {
  display: inline-flex;
}
.phase-bar {
  margin-top: auto;
  height: 15px;
  border-radius: 4px;
  font-size: 0.62rem;
  line-height: 15px;
  text-align: center;
  color: #fff;
  overflow: hidden;
  white-space: nowrap;
}
.p-class {
  background: rgba(207, 74, 60, 0.72);
}
.p-exam {
  background: rgba(217, 80, 80, 0.8);
}
.p-holiday {
  background: rgba(85, 168, 159, 0.8);
}
.p-weekend {
  background: rgba(139, 127, 212, 0.3);
  color: #5b4fa8;
}
.p-out {
  background: var(--surface-2);
  color: var(--text-3);
}
/* 学期外的日子：不写死结论，留一个空白位等以后填 */
.p-blank {
  background: transparent;
  border: 1px dashed var(--border);
  color: var(--text-3);
  line-height: 13px;
}
/* 自定义性质：中性灰蓝，不跟内置几种抢色 */
.p-custom {
  background: rgba(120, 140, 170, 0.22);
  color: #4a5a72;
}
/* 定位过来的那条：闪几下 */
.dot.flash,
.sched-block.flash {
  animation: dotFlash 1.2s ease-in-out 3;
}
@keyframes dotFlash {
  0%,
  100% {
    transform: none;
    box-shadow: none;
  }
  35% {
    transform: scale(1.06);
    box-shadow: 0 0 0 3px rgba(207, 74, 60, 0.3);
  }
}
/* 截止旗标：一面插在时间轴上的小旗子，位置＝落点时刻 */
.flag {
  position: absolute;
  left: 0;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  transform: translateY(-8px);
  pointer-events: auto;
  z-index: 3;
}
/* 靠右插旗：旗杆落在这一列右侧的时间点上，文字在左，不压住左侧的日程文字 */
.week-flag-layer .flag {
  right: 4px;
  left: auto;
  flex-direction: row-reverse;
  gap: 2px;
}
/* 旗杆 */
.flag::before {
  content: '';
  width: 2px;
  height: 16px;
  border-radius: 2px;
  background: #c9584f;
  flex-shrink: 0;
}
.flag.done::before {
  background: var(--success);
}
.flag-pin {
  width: 0;
  height: 0;
  border-top: 7px solid transparent;
  border-bottom: 7px solid transparent;
  border-left: 13px solid #c9584f;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.22));
  flex-shrink: 0;
}
.flag.done .flag-pin {
  border-left-color: var(--success);
}
.flag-text {
  font-family: var(--font-num);
  font-size: 0.7rem;
  font-weight: 700;
  font-style: normal;
  color: #fff;
  background: #c9584f;
  border-radius: 5px;
  padding: 1px 4px;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.16);
}
.flag.done .flag-text {
  background: var(--success);
}
.flag.on-timeline {
  left: 52px;
}
.grade {
  position: absolute;
  top: 5px;
  left: 6px;
  min-width: 19px;
  height: 19px;
  padding: 0 4px;
  border-radius: 7px;
  font-family: var(--font-num);
  font-weight: 700;
  font-size: 0.72rem;
  line-height: 19px;
  text-align: center;
  color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  z-index: 2;
}
.grade.g-S {
  background: linear-gradient(135deg, #e8b53c, #d99b1f);
}
.grade.g-A {
  background: linear-gradient(135deg, #58b978, #3f9c60);
}
.grade.g-B {
  background: linear-gradient(135deg, #5b8def, #4173d6);
}
.grade.g-C {
  background: var(--text-3);
}
.grade.g-D {
  background: #c4756b;
}
/* 周视图的列也要定位基准 */
.week-col {
  position: relative;
}
.custom-phase {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.4rem;
}
.month-tip {
  margin-top: 0.8rem;
  font-size: 0.8rem;
  color: var(--text-3);
}
.month-tip b {
  color: var(--accent);
}

/* 周视图 */
.week-banner {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.6rem 1rem;
  border-radius: 12px;
  margin-bottom: 0.9rem;
  background: var(--surface-2);
}
.wb-tag {
  font-family: var(--font-display);
  font-size: 1.05rem;
}
.wb-meta {
  color: var(--text);
  opacity: 0.78;
  font-size: 0.85rem;
}
.tag-exam {
  background: rgba(217, 80, 80, 0.14);
}
.tag-exam .wb-tag {
  color: var(--danger);
}
.tag-busy {
  background: rgba(207, 74, 60, 0.16);
}
.tag-busy .wb-tag {
  color: var(--accent);
}
.tag-easy {
  background: rgba(85, 168, 159, 0.16);
}
.tag-easy .wb-tag {
  color: #3d827a;
}
.tag-holiday {
  background: rgba(155, 107, 217, 0.16);
}
.tag-holiday .wb-tag {
  color: #7d52b8;
}
.week-grid {
  align-items: stretch;
  display: grid;
  /* minmax(0,1fr)：不理会内容的最小宽度，7 列永远等宽（否则长标题会把列撑宽、列宽不齐） */
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
  /* 整块用一条连续曲线裁下缘：光滑的下边缘 + 卡片间空隙 */
  clip-path: url(#weekCurve);
}
/* 旗标层的定位基准：必须就是周网格本身，否则 top 会相对别的祖先计算，旗子会飘到错误高度 */
.week-wrap {
  position: relative;
}
.week-flag-layer {
  position: absolute;
  inset: 0;
  display: grid;
  /* 必须和 .week-grid 用同一套轨道定义，否则旗子会横向错位、插到隔壁列上 */
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
  pointer-events: none;
  z-index: 4;
}
.flag-col {
  position: relative;
}
.week-flag-layer .flag {
  transition: top 0.34s cubic-bezier(0.22, 0.9, 0.3, 1);
}
/* 压到文字行上时只留小旗，时刻收起来（悬停这一列会展开） */
.flag.compact .flag-text {
  display: none;
}
.week-clip-defs {
  position: absolute;
  width: 0;
  height: 0;
}
.week-col {
  height: 312px;
  position: relative;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  padding: 8px;
  cursor: pointer;
  transition: box-shadow 0.16s ease, border-color 0.16s ease;
}
.week-col:hover {
  z-index: 3;
}
.week-col.today {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 2px var(--accent);
}
.wc-head {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  margin-bottom: 6px;
}
.wc-head .wk {
  position: static;
}
.wc-wd {
  font-size: 0.74rem;
  color: var(--text-3);
}
.wc-date {
  font-family: var(--font-num);
  font-size: 1.6rem;
  line-height: 1;
  color: var(--text);
  font-weight: 700;
}
.wb-week {
  font-family: var(--font-num);
  font-weight: 700;
  font-size: 0.78rem;
  color: var(--text-2);
  margin-left: 0.5rem;
}
.wc-body {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 5px;
}
.wc-count {
  font-size: 0.7rem;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.wc-phase {
  height: 15px;
  border-radius: 4px;
  font-size: 0.62rem;
  line-height: 15px;
  text-align: center;
  color: #fff;
  margin-bottom: 5px;
  overflow: hidden;
  white-space: nowrap;
}
.wc-body .icons {
  margin-left: auto;
}

/* 滚轮切换的滑入动画 */
@keyframes slideNext {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes slidePrev {
  from {
    opacity: 0;
    transform: translateX(-30px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.slide-next {
  animation: slideNext 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}
.slide-prev {
  animation: slidePrev 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}
.wc-events {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.dot {
  font-size: 0.8rem;
  line-height: 1.5;
  border-radius: 4px;
  padding: 0 1px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 不再用蓝/红/绿衬色，只靠颜色轻重和粗细分 */
.k-schedule {
  color: var(--text);
}
.k-task {
  color: var(--text);
  font-weight: 600;
}
.k-plan {
  color: var(--text-2);
}
.more {
  font-size: 0.74rem;
  color: var(--text-3);
}

/* 日视图 */
.day-layout {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
}
.timeline {
  position: relative;
  flex: 1;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  overflow: hidden;
}
.hour-row {
  height: 56px;
  border-bottom: 1px solid var(--border);
}
.hour-row:last-child {
  border-bottom: none;
}
.hour {
  font-size: 0.72rem;
  color: var(--text-3);
  padding-left: 8px;
  line-height: 56px;
}
.sched-block {
  position: absolute;
  left: 62px;
  right: 10px;
  background: rgba(91, 141, 239, 0.16);
  border-left: 3px solid #5b8def;
  border-radius: 8px;
  padding: 3px 8px;
  font-size: 0.8rem;
  overflow: hidden;
}
.sched-block em {
  display: block;
  font-style: normal;
  color: var(--text-2);
  font-size: 0.72rem;
}
.day-side {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.side-card {
  background: var(--surface);
  border-radius: 12px;
  padding: 0.9rem;
  box-shadow: var(--shadow);
}
.side-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}
.side-head h4 {
  margin: 0;
}
.side-sub {
  font-size: 0.74rem;
  color: var(--text-3);
}
.done-toggle {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.74rem;
  color: var(--text-3);
  cursor: pointer;
}
.busy-edit {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px dashed var(--border);
}
.be-label {
  font-size: 0.76rem;
  color: var(--text-3);
  white-space: nowrap;
}
.be-input {
  flex: 1;
  min-width: 0;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.82rem;
}
.be-clear {
  border: 1px solid var(--border);
  background: none;
  color: var(--text-3);
  border-radius: 7px;
  padding: 0.25rem 0.5rem;
  font-size: 0.74rem;
  cursor: pointer;
  white-space: nowrap;
}
.be-clear:hover {
  border-color: var(--accent);
  color: var(--accent);
}
/* 当天性质选择 */
.phase-edit {
  margin-bottom: 0.6rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px dashed var(--border);
}
.phase-edit .be-label {
  display: block;
  margin-bottom: 0.35rem;
}
.be-hint {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.7rem;
  color: var(--text-3);
  line-height: 1.5;
}
.phase-opts {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.phase-opt {
  font-family: var(--font-display);
  font-size: 0.76rem;
  padding: 0.16rem 0.6rem;
  border: 1.5px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  transition:
    border-color 0.14s ease,
    color 0.14s ease,
    background-color 0.14s ease;
}
.phase-opt:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.phase-opt.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
h4 {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}
.quick-add {
  margin-top: 0.6rem;
  padding-top: 0.6rem;
  border-top: 1px dashed var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.qa-title {
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.86rem;
}
.qa-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.qa-row input[type='time'],
.qa-row select {
  padding: 0.3rem 0.35rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.78rem;
}
.dash {
  color: var(--text-3);
}
.qa-btn {
  margin-left: auto;
  padding: 0.35rem 0.9rem;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.82rem;
}
.mood-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.6rem;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: var(--surface-2);
  padding: 3px 9px;
  border-radius: 10px;
  font-size: 0.82rem;
}
.open-journal {
  width: 100%;
  padding: 0.45rem;
  border: 1px solid var(--accent);
  background: var(--surface);
  color: var(--accent);
  border-radius: 9px;
  cursor: pointer;
  font-size: 0.85rem;
}
.none {
  color: var(--text-3);
  font-size: 0.84rem;
  margin: 0 0 0.5rem;
}
</style>
