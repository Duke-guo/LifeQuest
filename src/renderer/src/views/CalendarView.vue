<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTasksStore } from '../stores/tasks'
import { usePlansStore } from '../stores/plans'
import { useJournalIndexStore } from '../stores/journalIndex'
import { useSemesterStore } from '../stores/semester'
import {
  eventsFromTasks,
  eventsFromPlans,
  summarizeWeek,
  WEATHER_META,
  MOOD_META
} from '../utils/schedule'
import { toDateStr } from '../utils/helpers'
import AppIcon from '../components/AppIcon.vue'
import TaskItem from '../components/TaskItem.vue'
import TaskEditModal from '../components/TaskEditModal.vue'
import type { CalendarEvent, Task } from '../../../shared/types'

const emit = defineEmits<{ openJournal: [date: string] }>()
const props = defineProps<{ focusDate?: string }>()

const tasksStore = useTasksStore()
const plansStore = usePlansStore()
const journalIndex = useJournalIndexStore()
const semesterStore = useSemesterStore()

type Mode = 'day' | 'week' | 'month'
const mode = ref<Mode>('month')
const cursor = ref(new Date())
const editing = ref<Task | null>(null)
const showDone = ref(false)

// 日视图侧边栏：快速新增
const newTitle = ref('')
const newStart = ref('09:00')
const newEnd = ref('10:00')
const newImp = ref(3)

onMounted(async () => {
  if (!tasksStore.loaded) await tasksStore.load()
  await plansStore.load()
  await journalIndex.load()
  await semesterStore.load()
  if (props.focusDate) {
    const [fy, fm, fd] = props.focusDate.split('-').map(Number)
    cursor.value = new Date(fy, fm - 1, fd)
    mode.value = 'day'
  }
})

const today = toDateStr(new Date())
const year = computed(() => cursor.value.getFullYear())
const month = computed(() => cursor.value.getMonth())
const cursorIso = computed(() => toDateStr(cursor.value))

const visibleRange = computed<[string, string]>(() => {
  if (mode.value === 'day') return [cursorIso.value, cursorIso.value]
  if (mode.value === 'week') return [weekDays.value[0], weekDays.value[6]]
  const first = toDateStr(new Date(year.value, month.value, 1))
  const last = toDateStr(new Date(year.value, month.value + 1, 0))
  return [first, last]
})

const events = computed<CalendarEvent[]>(() => {
  const [s, e] = visibleRange.value
  return [
    ...eventsFromTasks(tasksStore.tasks, s, e, semesterStore.noClassDates),
    ...eventsFromPlans(plansStore.plans)
  ]
})

function eventsOn(date: string): CalendarEvent[] {
  return events.value
    .filter((e) => e.date === date)
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
}

/** 当天实际发生的任务（含重复日程展开出来的那一次） */
const dayTasks = computed(() => {
  const ids = new Set(eventsOn(cursorIso.value).map((e) => e.refId))
  return tasksStore.tasks
    .filter((t) => ids.has(t.id) && (showDone.value || t.status !== 'done'))
    .sort((a, b) => (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99'))
})

// ---------- 忙碌程度概括（月视图用） ----------
function hoursOf(e: CalendarEvent): number {
  if (!e.time || !e.endTime) return 1
  const [sh, sm] = e.time.split(':').map(Number)
  const [eh, em] = e.endTime.split(':').map(Number)
  return Math.max(0.5, (eh * 60 + (em || 0) - sh * 60 - (sm || 0)) / 60)
}

function loadScore(date: string): number {
  return eventsOn(date).reduce((s, e) => s + hoursOf(e), 0)
}

function busyLabel(date: string): string {
  const n = eventsOn(date).length
  if (n === 0) return '空闲'
  const h = loadScore(date)
  if (h >= 7) return '好忙'
  if (h >= 4.5) return '较忙'
  if (h >= 2.5) return '一般'
  return '轻松'
}

function busyClass(date: string): string {
  const n = eventsOn(date).length
  if (n === 0) return 'b-free'
  const h = loadScore(date)
  if (h >= 7) return 'b-hard'
  if (h >= 4.5) return 'b-busy'
  if (h >= 2.5) return 'b-mid'
  return 'b-easy'
}

const PHASE_LABEL: Record<string, string> = {
  class: '上课',
  exam: '考试周',
  holiday: '放假',
  weekend: '周末',
  before: '开学前',
  after: '学期结束',
  unknown: ''
}

const PHASE_CLASS: Record<string, string> = {
  class: 'p-class',
  exam: 'p-exam',
  holiday: 'p-holiday',
  weekend: 'p-weekend',
  before: 'p-out',
  after: 'p-out',
  unknown: 'p-out'
}

function dayPhase(date: string): string {
  return semesterStore.phaseOf(date, eventsOn(date).length > 0)
}

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

const weekSummary = computed(() => summarizeWeek(tasksStore.tasks, weekStart.value))

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

function goToday(): void {
  cursor.value = new Date()
}

function drillTo(date: string): void {
  const [y, m, d] = date.split('-').map(Number)
  cursor.value = new Date(y, m - 1, d)
  mode.value = 'day'
}

const title = computed(() => {
  if (mode.value === 'day') return cursorIso.value
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
</script>

<template>
  <div class="calendar-view">
    <header class="view-head">
      <div>
        <h2>日历</h2>
        <p class="sub">任务 · 日程 · 计划 · 日记，一处聚合</p>
      </div>
      <div class="controls">
        <div class="modes">
          <button :class="{ on: mode === 'day' }" @click="mode = 'day'">日</button>
          <button :class="{ on: mode === 'week' }" @click="mode = 'week'">周</button>
          <button :class="{ on: mode === 'month' }" @click="mode = 'month'">月</button>
        </div>
        <div class="nav">
          <button @click="shift(-1)">‹</button>
          <span class="label">{{ title }}</span>
          <button @click="shift(1)">›</button>
          <button class="today-btn" @click="goToday">今天</button>
        </div>
      </div>
    </header>

    <!-- ========== 月视图（只显示概括，不堆文字） ========== -->
    <template v-if="mode === 'month'">
      <div class="weekdays">
        <span v-for="w in ['日', '一', '二', '三', '四', '五', '六']" :key="w">{{ w }}</span>
      </div>
      <div class="grid">
        <div
          v-for="(c, i) in monthCells"
          :key="i"
          class="cell"
          :class="{ empty: !c.inMonth, today: c.date === today }"
          @click="c.inMonth && drillTo(c.date)"
        >
          <template v-if="c.inMonth">
            <div class="cell-head">
              <span class="day">{{ c.day }}</span>
              <span class="wk">第{{ semesterStore.weekOf(c.date) }}周</span>
            </div>
            <div class="cell-mid">
              <span class="busy" :class="busyClass(c.date)">
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
              {{ semesterStore.holidayOn(c.date)?.name ?? PHASE_LABEL[dayPhase(c.date)] }}
            </div>
          </template>
        </div>
      </div>

      <!-- 说明：点格子进日视图，文字细节都在那里 -->
      <p class="month-tip">
        点任意格子进入<b>日视图</b>：那里可以看到、修改和新增当天的每一项安排，并能调整重要程度。
      </p>
    </template>

    <!-- ========== 周视图 ========== -->
    <template v-else-if="mode === 'week'">
      <div class="week-banner" :class="TAG_CLASS[weekSummary.tag]">
        <span class="wb-tag">{{ weekSummary.tag }}</span>
        <span class="wb-meta">
          共 {{ weekSummary.taskCount }} 项 · 日程 {{ weekSummary.scheduleCount }} 个 · 重要度合计 {{ weekSummary.score }}
        </span>
      </div>
      <div class="week-grid">
        <div v-for="d in weekDays" :key="d" class="week-col" :class="{ today: d === today }" @click="drillTo(d)">
          <div class="wc-head">
            <span class="wc-date">{{ d.slice(5) }}</span>
            <span class="wk">第{{ semesterStore.weekOf(d) }}周</span>
          </div>
          <div class="wc-body">
            <span class="busy" :class="busyClass(d)">{{ busyLabel(d) }}</span>
            <span class="wc-count">{{ eventsOn(d).length }} 项</span>
          </div>
          <div class="wc-events">
            <span v-for="e in eventsOn(d).slice(0, 4)" :key="e.id" class="dot" :class="`k-${e.kind}`">
              {{ e.time ? e.time + ' ' : '' }}{{ e.title }}
            </span>
            <span v-if="eventsOn(d).length > 4" class="more">+{{ eventsOn(d).length - 4 }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ========== 日视图（左时间轴 + 右可编辑侧栏） ========== -->
    <template v-else>
      <div class="day-layout">
        <div class="timeline">
          <div v-for="h in HOURS" :key="h" class="hour-row">
            <span class="hour">{{ String(h).padStart(2, '0') }}:00</span>
          </div>
          <div
            v-for="e in daySchedules"
            :key="e.id"
            class="sched-block"
            :style="{ top: topOf(e.time!) + 'px', height: heightOf(e.time!, e.endTime ?? e.time!) + 'px' }"
          >
            <strong>{{ e.time }}–{{ e.endTime }}</strong> {{ e.title }}
            <em v-if="e.meta?.location">{{ e.meta.location }}</em>
          </div>
        </div>

        <aside class="day-side">
          <!-- 当天安排：与任务页一致，可勾选 / 编辑 / 删除 / 调重要度 -->
          <div class="side-card">
            <div class="side-head">
              <h4>当天安排</h4>
              <span class="side-sub">{{ dayTasks.length }} 项</span>
              <label class="done-toggle">
                <input v-model="showDone" type="checkbox" />
                显示已完成
              </label>
            </div>

            <div v-if="dayTasks.length === 0" class="none">这天还没有安排</div>
            <TaskItem
              v-for="t in dayTasks"
              :key="t.id"
              :task="t"
              @toggle="toggleTask(t)"
              @edit="editing = t"
              @remove="tasksStore.removeTask(t.id)"
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
  font-weight: 600;
  min-width: 150px;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.day {
  font-size: 0.82rem;
  color: var(--text-2);
}
.wk {
  font-size: 0.62rem;
  color: var(--text-3);
  background: var(--surface-2);
  padding: 0 4px;
  border-radius: 5px;
}
.cell-mid {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.3rem;
  margin-top: 0.35rem;
}
.busy {
  font-size: 0.72rem;
  font-weight: 600;
  border-radius: 6px;
  padding: 1px 6px;
}
.b-hard {
  background: rgba(217, 80, 80, 0.16);
  color: var(--danger);
}
.b-busy {
  background: rgba(217, 138, 43, 0.18);
  color: var(--accent);
}
.b-mid {
  background: rgba(217, 165, 43, 0.16);
  color: #a8801f;
}
.b-easy {
  background: rgba(85, 168, 159, 0.16);
  color: #3d827a;
}
.b-free {
  background: var(--surface-2);
  color: var(--text-3);
}
.icons {
  display: inline-flex;
  gap: 3px;
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
  background: rgba(217, 138, 43, 0.72);
}
.p-exam {
  background: rgba(217, 80, 80, 0.8);
}
.p-holiday {
  background: rgba(85, 168, 159, 0.8);
}
.p-weekend,
.p-out {
  background: var(--surface-2);
  color: var(--text-3);
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
  color: var(--text-2);
  font-size: 0.85rem;
}
.tag-exam {
  background: rgba(217, 80, 80, 0.14);
}
.tag-exam .wb-tag {
  color: var(--danger);
}
.tag-busy {
  background: rgba(217, 138, 43, 0.16);
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
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.week-col {
  min-height: 220px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 8px;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.week-col:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
}
.week-col.today {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.wc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
}
.wc-date {
  font-size: 0.82rem;
  color: var(--text-2);
  font-weight: 600;
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
}
.wc-events {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.dot {
  font-size: 0.7rem;
  border-radius: 4px;
  padding: 1px 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.k-schedule {
  background: rgba(91, 141, 239, 0.16);
  color: #3f6fd0;
}
.k-task {
  background: var(--accent-soft);
  color: var(--accent-text);
}
.k-plan {
  background: rgba(85, 168, 159, 0.16);
  color: #3d827a;
}
.more {
  font-size: 0.68rem;
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
