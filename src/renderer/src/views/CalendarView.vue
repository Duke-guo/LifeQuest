<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTasksStore } from '../stores/tasks'
import { usePlansStore } from '../stores/plans'
import { useJournalIndexStore } from '../stores/journalIndex'
import {
  eventsFromTasks,
  eventsFromPlans,
  summarizeWeek,
  WEATHER_META,
  MOOD_META
} from '../utils/schedule'
import { toDateStr } from '../utils/helpers'
import AppIcon from '../components/AppIcon.vue'
import type { CalendarEvent } from '../../../shared/types'

const emit = defineEmits<{ openJournal: [date: string] }>()
const props = defineProps<{ focusDate?: string }>()

const tasksStore = useTasksStore()
const plansStore = usePlansStore()
const journalIndex = useJournalIndexStore()

type Mode = 'day' | 'week' | 'month'
const mode = ref<Mode>('month')
const cursor = ref(new Date())

onMounted(async () => {
  if (!tasksStore.loaded) await tasksStore.load()
  await plansStore.load()
  await journalIndex.load()
  if (props.focusDate) {
    cursor.value = new Date(props.focusDate)
    mode.value = 'day'
  }
})

const today = toDateStr(new Date())
const year = computed(() => cursor.value.getFullYear())
const month = computed(() => cursor.value.getMonth())

const events = computed<CalendarEvent[]>(() => [
  ...eventsFromTasks(tasksStore.tasks),
  ...eventsFromPlans(plansStore.plans)
])

function eventsOn(date: string): CalendarEvent[] {
  return events.value
    .filter((e) => e.date === date)
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
}

const KIND_LABEL: Record<string, string> = {
  schedule: '日程',
  task: '任务',
  plan: '计划',
  journal: '日记'
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

// ---------- 日视图 ----------
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6:00 - 23:00

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

const daySchedules = computed(() => eventsOn(toDateStr(cursor.value)).filter((e) => e.kind === 'schedule' && e.time))
const dayOthers = computed(() => eventsOn(toDateStr(cursor.value)).filter((e) => e.kind !== 'schedule' || !e.time))

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
  cursor.value = new Date(date)
  mode.value = mode.value === 'month' ? 'day' : 'day'
}

const title = computed(() => {
  if (mode.value === 'day') return toDateStr(cursor.value)
  if (mode.value === 'week') return `${weekSummary.value.start} ~ ${weekSummary.value.end}`
  return `${year.value} 年 ${month.value + 1} 月`
})
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

    <!-- ========== 月视图 ========== -->
    <template v-if="mode === 'month'">
      <div class="weekdays">
        <span v-for="w in ['日', '一', '二', '三', '四', '五', '六']" :key="w">{{ w }}</span>
      </div>
      <div class="grid">
        <div
          v-for="(c, i) in monthCells"
          :key="i"
          class="cell"
          :class="{ empty: !c.inMonth, today: c.date === today, marked: c.inMonth && !!journalIndex.on(c.date) }"
          @click="c.inMonth && drillTo(c.date)"
        >
          <div class="cell-head">
            <span class="day">{{ c.day || '' }}</span>
            <span
              v-if="c.inMonth && journalIndex.on(c.date)?.weather"
              class="wx"
              :style="{ color: WEATHER_META[journalIndex.on(c.date)!.weather!].color }"
              :title="WEATHER_META[journalIndex.on(c.date)!.weather!].label"
            >
              <AppIcon :name="journalIndex.on(c.date)!.weather!" :size="13" />
            </span>
          </div>
          <div v-if="c.inMonth" class="dots">
            <span
              v-for="e in eventsOn(c.date).slice(0, 4)"
              :key="e.id"
              class="dot"
              :class="`k-${e.kind}`"
              :title="`${KIND_LABEL[e.kind]}：${e.title}`"
            >
              {{ e.time ? e.time + ' ' : '' }}{{ e.title }}
            </span>
            <span v-if="eventsOn(c.date).length > 4" class="more">+{{ eventsOn(c.date).length - 4 }}</span>
          </div>
        </div>
      </div>
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
        <div
          v-for="d in weekDays"
          :key="d"
          class="week-col"
          :class="{ today: d === today }"
          @click="drillTo(d)"
        >
          <div class="wc-head">
            <span class="wc-date">{{ d.slice(5) }}</span>
            <span
              v-if="journalIndex.on(d)?.mood"
              class="wc-mood"
              :style="{ color: MOOD_META[journalIndex.on(d)!.mood!].color }"
            >
              <AppIcon :name="`mood-${journalIndex.on(d)!.mood}`" :size="15" />
            </span>
          </div>
          <div class="wc-events">
            <span v-for="e in eventsOn(d)" :key="e.id" class="dot" :class="`k-${e.kind}`">
              {{ e.time ? e.time + ' ' : '' }}{{ e.title }}
            </span>
            <span v-if="eventsOn(d).length === 0" class="wc-none">—</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ========== 日视图（时间段） ========== -->
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
          <div v-if="journalIndex.on(toDateStr(cursor))" class="mood-card">
            <h4>当日日记</h4>
            <div class="mood-row">
              <span
                v-if="journalIndex.on(toDateStr(cursor))!.weather"
                class="chip"
                :style="{ color: WEATHER_META[journalIndex.on(toDateStr(cursor))!.weather!].color }"
              >
                <AppIcon :name="journalIndex.on(toDateStr(cursor))!.weather!" :size="15" />
                {{ WEATHER_META[journalIndex.on(toDateStr(cursor))!.weather!].label }}
              </span>
              <span
                v-if="journalIndex.on(toDateStr(cursor))!.mood"
                class="chip"
                :style="{ color: MOOD_META[journalIndex.on(toDateStr(cursor))!.mood!].color }"
              >
                <AppIcon :name="`mood-${journalIndex.on(toDateStr(cursor))!.mood}`" :size="15" />
                {{ MOOD_META[journalIndex.on(toDateStr(cursor))!.mood!].label }}
              </span>
            </div>
            <button class="open-journal" @click="emit('openJournal', toDateStr(cursor))">打开这天的日记</button>
          </div>
          <div v-else class="mood-card">
            <h4>当日日记</h4>
            <p class="none">这天还没有写日记</p>
            <button class="open-journal" @click="emit('openJournal', toDateStr(cursor))">去写这天的日记</button>
          </div>

          <div class="other-card">
            <h4>当天其它事项</h4>
            <div v-if="dayOthers.length === 0" class="none">无</div>
            <div v-for="e in dayOthers" :key="e.id" class="other-row">
              <span class="dot" :class="`k-${e.kind}`">{{ KIND_LABEL[e.kind] }}</span>
              <span>{{ e.title }}</span>
            </div>
          </div>
        </aside>
      </div>
    </template>
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
  min-height: 96px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 6px;
  overflow: hidden;
  cursor: pointer;
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
.cell.marked .day {
  font-weight: 700;
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
.wx {
  display: inline-flex;
}
.dots {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
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
  margin-bottom: 6px;
}
.wc-date {
  font-size: 0.82rem;
  color: var(--text-2);
  font-weight: 600;
}
.wc-events {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.wc-none {
  color: var(--text-3);
  font-size: 0.8rem;
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
  padding: 0;
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
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.mood-card,
.other-card {
  background: var(--surface);
  border-radius: 12px;
  padding: 1rem;
  box-shadow: var(--shadow);
}
h4 {
  margin: 0 0 0.6rem;
  font-size: 0.95rem;
}
.mood-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.7rem;
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
  font-size: 0.85rem;
  margin: 0 0 0.6rem;
}
.other-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  padding: 0.2rem 0;
}
</style>
