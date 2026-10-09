<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTasksStore } from '../stores/tasks'
import { useJournalIndexStore } from '../stores/journalIndex'
import { useSemesterStore } from '../stores/semester'
import { useGamificationStore } from '../stores/gamification'
import { useConfirmStore } from '../stores/confirm'
import { eventsFromTasks, eventHours, nextOccurrence, WEATHER_META, MOOD_META } from '../utils/schedule'
import { computeDayColor } from '../utils/dayColor'
import { noteFromTask } from '../utils/noteActions'
import { toDateStr } from '../utils/helpers'
import AppIcon from '../components/AppIcon.vue'
import TaskItem from '../components/TaskItem.vue'
import TaskEditModal from '../components/TaskEditModal.vue'
import type { Task } from '../../../shared/types'

const emit = defineEmits<{
  navigate: [key: string]
  openJournal: [date: string]
  openNote: [id: string]
  openCalendar: [date: string, mode?: 'day' | 'week', taskId?: string]
}>()

const tasksStore = useTasksStore()
const journalIndex = useJournalIndexStore()
const semesterStore = useSemesterStore()
const gStore = useGamificationStore()
const confirm = useConfirmStore()

const editing = ref<Task | null>(null)

onMounted(async () => {
  if (!tasksStore.loaded) await tasksStore.load()
  await journalIndex.load()
  await semesterStore.load()
  await gStore.refresh()
})

const today = toDateStr(new Date())

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜已深'
  if (h < 11) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const dateText = computed(() => {
  const d = new Date()
  const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${wd}`
})

const weekNo = computed(() => semesterStore.weekOf(today))

/** 今天实际发生的事项 */
const todayTasks = computed(() => {
  const evs = eventsFromTasks(tasksStore.tasks, today, today, semesterStore.noClassDates)
  const ids = new Set(evs.map((e) => e.refId))
  return tasksStore.tasks
    .filter((t) => ids.has(t.id))
    .sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1
      if (b.status === 'done' && a.status !== 'done') return -1
      return (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99')
    })
})

const PHASE_TEXT: Record<string, string> = {
  class: '上课中',
  exam: '考试周',
  holiday: '放假中',
  weekend: '周末',
  before: '还没开学',
  after: '学期已结束'
}

const phaseText = computed(
  () => PHASE_TEXT[semesterStore.phaseOf(today, todayTasks.value.length > 0)] ?? ''
)

const todayHours = computed(() =>
  eventsFromTasks(tasksStore.tasks, today, today, semesterStore.noClassDates).reduce(
    (s, e) => s + eventHours(e),
    0
  )
)

const todayColor = computed(() => {
  const j = journalIndex.on(today)
  return computeDayColor(today, todayHours.value, todayTasks.value.length, j?.mood, j?.weather)
})

const todayJournal = computed(() => journalIndex.on(today))

/** 学期进度 */
const semesterProgress = computed(() => {
  const sem = semesterStore.semester
  if (!sem.start || !sem.teachingEnd) return null
  const total = Math.max(
    1,
    Math.round((new Date(sem.teachingEnd).getTime() - new Date(sem.start).getTime()) / 604800000)
  )
  const done = weekNo.value ?? 0
  return { total, week: done, percent: Math.min(100, Math.round((done / total) * 100)) }
})

/** 距期末还有几天 */
const daysToExam = computed(() => {
  const sem = semesterStore.semester
  if (!sem.examStart) return null
  const d = Math.ceil((new Date(sem.examStart).getTime() - new Date(today).getTime()) / 86400000)
  return d
})

/** 本周 7 天（周一起）：每天的实际负担与颜色 */
const weekDays = computed(() => {
  const d = new Date()
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
  const labels = ['一', '二', '三', '四', '五', '六', '日']
  return labels.map((label, i) => {
    const cur = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    const ds = toDateStr(cur)
    const evs = eventsFromTasks(tasksStore.tasks, ds, ds, semesterStore.noClassDates)
    const hours = evs.reduce((s, e) => s + eventHours(e), 0)
    const j = journalIndex.on(ds)
    return {
      date: ds,
      label,
      num: cur.getDate(),
      count: evs.length,
      hours,
      color: computeDayColor(ds, hours, evs.length, j?.mood, j?.weather),
      isToday: ds === today
    }
  })
})

const weekHours = computed(() => weekDays.value.reduce((s, d) => s + d.hours, 0))

/** 最近写过的日记（倒序） */
const recentJournals = computed(() => [...journalIndex.entries].reverse().slice(0, 5))

/** 接下来 14 天里的重要事项 */
const upcoming = computed(() => {
  const from = today
  const end = toDateStr(new Date(Date.now() + 14 * 86400000))
  const evs = eventsFromTasks(tasksStore.tasks, from, end, semesterStore.noClassDates)
  const seen = new Set<string>()
  return evs
    .filter((e) => (e.meta?.importance ?? 0) >= 4)
    .filter((e) => {
      if (seen.has(e.refId)) return false
      seen.add(e.refId)
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6)
})

async function toggleTask(t: Task): Promise<void> {
  await tasksStore.setStatus(t.id, t.status === 'done' ? 'todo' : 'done')
}

/** 一键为今天这节课写笔记 */
async function writeNote(t: Task): Promise<void> {
  const id = await noteFromTask(t)
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

/** 跳去日历，定位到这件事所在的（或将来最近的）那一周 */
function locate(t: Task): void {
  const date = nextOccurrence(t, today, semesterStore.noClassDates) ?? t.due
  if (date) emit('openCalendar', date, 'week', t.id)
}
</script>

<template>
  <div class="home">
    <!-- 问候 -->
    <header class="hero">
      <div class="hero-left">
        <h1>{{ greeting }}</h1>
        <p class="hero-date">{{ dateText }}</p>
        <div class="hero-tags">
          <span v-if="weekNo" class="tag week">第 {{ weekNo }} 周</span>
          <span v-if="phaseText" class="tag phase">{{ phaseText }}</span>
          <span class="tag busy" :style="{ background: todayColor.chipBg, color: todayColor.chipFg }">
            {{ todayColor.tier }}<template v-if="todayTasks.length"> · {{ todayTasks.length }} 项</template>
          </span>
          <span v-if="todayJournal?.weather" class="tag">
            <AppIcon :name="todayJournal.weather" :size="13" />
            {{ WEATHER_META[todayJournal.weather].label }}
          </span>
          <span v-if="todayJournal?.mood" class="tag">
            <AppIcon :name="`mood-${todayJournal.mood}`" :size="13" />
            {{ MOOD_META[todayJournal.mood].label }}
          </span>
        </div>
      </div>

      <!-- 快捷入口 -->
      <div class="quick">
        <button class="q-btn" @click="emit('openJournal', today)">
          <AppIcon name="journal" :size="18" />写今天日记
        </button>
        <button class="q-btn" @click="emit('navigate', 'tasks')">
          <AppIcon name="tasks" :size="18" />加任务
        </button>
        <button class="q-btn" @click="emit('navigate', 'calendar')">
          <AppIcon name="calendar" :size="18" />看日历
        </button>
      </div>
    </header>

    <div class="cols">
      <!-- 今天 -->
      <section class="card">
        <div class="card-head">
          <h3>今天的安排</h3>
          <span class="card-sub">{{ todayTasks.length }} 项 · 约 {{ Math.round(todayHours) }} 小时</span>
        </div>
        <div v-if="todayTasks.length === 0" class="none">今天还没有安排</div>
        <TaskItem
          v-for="t in todayTasks"
          :key="t.id"
          :task="t"
          @toggle="toggleTask(t)"
          @edit="editing = t"
          @remove="removeTask(t)"
          @note="writeNote(t)"
              @locate="locate(t)"
              @edit-child="editing = $event"
        />
      </section>

      <div class="side-col">
        <!-- 学期 -->
        <section class="card">
          <div class="card-head">
            <h3>学期进度</h3>
            <span class="card-sub">{{ semesterStore.semester.name }}</span>
          </div>
          <template v-if="semesterProgress">
            <div class="bar">
              <div class="bar-fill" :style="{ width: semesterProgress.percent + '%' }"></div>
            </div>
            <div class="bar-meta">
              <span>第 {{ semesterProgress.week }} / {{ semesterProgress.total }} 周</span>
              <span>{{ semesterProgress.percent }}%</span>
            </div>
          </template>
          <div v-if="daysToExam !== null" class="exam-line">
            距期末考试还有 <b>{{ daysToExam }}</b> 天
          </div>
          <div class="growth">
            Lv.{{ gStore.level }} · {{ gStore.xp }} XP
          </div>
        </section>

        <!-- 本周 -->
        <section class="card">
          <div class="card-head">
            <h3>本周</h3>
            <span class="card-sub">约 {{ Math.round(weekHours) }} 小时</span>
          </div>
          <div class="week">
            <button
              v-for="d in weekDays"
              :key="d.date"
              class="wd"
              :class="{ today: d.isToday }"
              :style="{ background: d.color.chipBg, color: d.color.chipFg }"
              :title="`${d.date}　${d.color.tier}　${d.count} 项`"
              @click="emit('navigate', 'calendar')"
            >
              <span class="wd-label">{{ d.label }}</span>
              <span class="wd-num">{{ d.num }}</span>
              <span class="wd-tier">{{ d.color.tier }}</span>
            </button>
          </div>
        </section>

        <!-- 近期重要（有才显示） -->
        <section v-if="upcoming.length" class="card">
          <div class="card-head">
            <h3>近期重要</h3>
            <span class="card-sub">未来 14 天</span>
          </div>
          <div v-for="e in upcoming" :key="e.id" class="up-row">
            <span class="up-date">{{ e.date.slice(5) }}</span>
            <span class="up-title">{{ e.title }}</span>
            <span v-if="e.time" class="up-time">{{ e.time }}</span>
          </div>
        </section>
      </div>
    </div>

    <!-- 最近日记（全宽，写得多了就自然填满页面） -->
    <section v-if="recentJournals.length" class="card recent">
      <div class="card-head">
        <h3>最近日记</h3>
        <span class="card-sub">点一条继续写</span>
      </div>
      <div
        v-for="j in recentJournals"
        :key="j.date"
        class="jr"
        :class="{ today: j.date === today }"
        @click="emit('openJournal', j.date)"
      >
        <span class="jr-date">{{ j.date.slice(5) }}</span>
        <span class="jr-icons">
          <AppIcon v-if="j.weather" :name="j.weather" :size="13" />
          <AppIcon v-if="j.mood" :name="`mood-${j.mood}`" :size="13" />
        </span>
        <span class="jr-text">{{ j.preview || '（还没写内容）' }}</span>
        <span v-if="j.date === today" class="jr-flag">今天</span>
      </div>
    </section>

    <TaskEditModal v-if="editing" :task="editing" @close="editing = null" />
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}
.hero h1 {
  font-size: 2.1rem;
  margin: 0;
  color: var(--accent);
}
.hero-date {
  color: var(--text-2);
  margin: 0.3rem 0 0.7rem;
}
.hero-tags {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  font-size: 0.8rem;
  border-radius: 8px;
  padding: 2px 9px;
  background: var(--surface-2);
  color: var(--text-2);
}
.tag.week {
  font-family: var(--font-num);
  font-weight: 700;
  background: var(--accent-soft);
  color: var(--accent-text);
}
.tag.busy {
  font-weight: 700;
}
.quick {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.q-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.86rem;
}
.q-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.cols {
  display: flex;
  gap: 1.1rem;
  align-items: flex-start;
}
.cols > .card {
  flex: 1.6;
}
.side-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  min-width: 280px;
}
.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.7rem;
}
.card-head h3 {
  font-size: 1.02rem;
}
.card-sub {
  font-size: 0.76rem;
  color: var(--text-3);
}
.bar {
  height: 10px;
  border-radius: 6px;
  background: var(--surface-2);
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 6px;
  transition: width 0.4s ease;
}
.bar-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.78rem;
  color: var(--text-2);
  margin-top: 0.35rem;
  font-family: var(--font-num);
  font-weight: 600;
}
.exam-line {
  margin-top: 0.7rem;
  font-size: 0.86rem;
  color: var(--text-2);
}
.exam-line b {
  font-family: var(--font-num);
  font-size: 1.15rem;
  color: var(--accent);
}
.growth {
  margin-top: 0.5rem;
  font-family: var(--font-num);
  font-weight: 700;
  color: var(--accent);
}
.up-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.84rem;
  padding: 0.22rem 0;
  border-bottom: 1px dashed var(--border);
}
.week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.3rem;
}
.wd {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 0.4rem 0 0.35rem;
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.15s;
}
.wd:hover {
  transform: translateY(-2px);
}
.wd.today {
  border-color: var(--accent);
}
.wd-label {
  font-size: 0.7rem;
  opacity: 0.85;
}
.wd-num {
  font-family: var(--font-num);
  font-weight: 700;
  font-size: 1.02rem;
  line-height: 1.1;
}
.wd-tier {
  font-size: 0.6rem;
  opacity: 0.9;
  white-space: nowrap;
  transform: scale(0.92);
}
.up-row:last-child {
  border-bottom: none;
}
.up-date {
  font-family: var(--font-num);
  font-weight: 700;
  color: var(--text-3);
}
.up-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.up-time {
  font-family: var(--font-num);
  color: var(--text-3);
}
.none {
  color: var(--text-3);
  font-size: 0.86rem;
}
.recent {
  margin-top: 1.1rem;
}
.jr {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.42rem 0.5rem;
  border-radius: 9px;
  cursor: pointer;
  font-size: 0.86rem;
}
.jr:hover {
  background: var(--surface-2);
}
.jr-date {
  font-family: var(--font-num);
  font-weight: 700;
  color: var(--text-3);
  min-width: 3.1rem;
}
.jr-icons {
  display: inline-flex;
  gap: 0.2rem;
  color: var(--text-3);
}
.jr-text {
  flex: 1;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.jr-flag {
  font-size: 0.7rem;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 6px;
  padding: 0 5px;
}
</style>
