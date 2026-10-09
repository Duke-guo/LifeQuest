<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useJournalIndexStore } from '../stores/journalIndex'
import { useNotesStore } from '../stores/notes'
import { useSemesterStore } from '../stores/semester'
import { extendNote } from '../utils/noteActions'
import { WEATHER_META, MOOD_META } from '../utils/schedule'
import { toDateStr } from '../utils/helpers'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ weekStart: string; weekEnd: string; days: string[] }>()
const emit = defineEmits<{ openJournal: [date: string]; openNote: [id: string] }>()

const journalIndex = useJournalIndexStore()
const notesStore = useNotesStore()
const semesterStore = useSemesterStore()

/** 0 = 每日日记，1 = 周记；滚轮切换，一次只显示一条 */
const row = ref(0)
const selKey = ref<string | null>(null)
let lock = 0

onMounted(async () => {
  await journalIndex.load()
  if (notesStore.notes.length === 0) await notesStore.list()
  if (!semesterStore.semester.start) await semesterStore.load()
})

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

function dayNum(date: string): string {
  return String(Number(date.slice(8)))
}
function weekdayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return WEEKDAY[new Date(y, m - 1, d).getDay()]
}
function shiftDate(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return toDateStr(new Date(y, m - 1, d + n))
}

interface DayNode {
  date: string
  has: boolean
  weather: string | null
  mood: string | null
  preview: string
}

const dayNodes = computed<DayNode[]>(() =>
  props.days.map((date) => {
    const j = journalIndex.on(date)
    const has = !!j && (j.hasContent || !!j.mood || !!j.weather)
    return {
      date,
      has,
      weather: j?.weather ?? null,
      mood: j?.mood ?? null,
      preview: j?.preview ?? ''
    }
  })
)

/** 周记 = 分类为「周记」的笔记，日期落在这一周里 */
function weeklyNoteOf(start: string, end: string): string | null {
  const found = notesStore.notes.find(
    (n) => n.category.trim() === '周记' && n.date >= start && n.date <= end
  )
  return found?.id ?? null
}

interface WeekNode {
  start: string
  end: string
  label: string
  noteId: string | null
  title: string
}

/** 本周 + 往前 5 周，凑成一条周记藤 */
const weekNodes = computed<WeekNode[]>(() => {
  const out: WeekNode[] = []
  for (let i = 0; i < 6; i++) {
    const start = shiftDate(props.weekStart, -7 * i)
    const end = shiftDate(props.weekEnd, -7 * i)
    const noteId = weeklyNoteOf(start, end)
    const wk = semesterStore.weekOf(start)
    out.push({
      start,
      end,
      label: wk ? `第 ${wk} 周` : `${start.slice(5)} 起`,
      noteId,
      title: noteId ? (notesStore.byId(noteId)?.title ?? '周记') : ''
    })
  }
  return out
})

const activeRow = computed(() => (row.value === 0 ? '每日日记' : '周记'))

function onWheel(e: WheelEvent): void {
  e.preventDefault()
  const now = Date.now()
  if (now < lock) return
  lock = now + 320
  row.value = row.value === 0 ? 1 : 0
  selKey.value = null
}

const selDay = computed(() =>
  row.value === 0 ? (dayNodes.value.find((d) => d.date === selKey.value) ?? null) : null
)
const selWeek = computed(() =>
  row.value === 1 ? (weekNodes.value.find((w) => w.start === selKey.value) ?? null) : null
)

function pickDay(d: DayNode): void {
  selKey.value = selKey.value === d.date ? null : d.date
}
function pickWeek(w: WeekNode): void {
  selKey.value = selKey.value === w.start ? null : w.start
}

/** 进入（或开始写）这天的日记 */
function openDay(date: string): void {
  emit('openJournal', date)
}

/** 打开或新建这一周的周记 */
async function openWeek(w: WeekNode): Promise<void> {
  if (w.noteId) {
    emit('openNote', w.noteId)
    return
  }
  const id = await extendNote({
    category: '周记',
    date: w.start,
    title: `周记 · ${w.start.slice(5)} ~ ${w.end.slice(5)}`
  })
  await notesStore.list()
  emit('openNote', id)
}
</script>

<template>
  <section class="jvine" @wheel="onWheel">
    <div class="jv-bar">
      <button class="jv-tab" :class="{ on: row === 0 }" @click="row = 0">每日日记</button>
      <button class="jv-tab" :class="{ on: row === 1 }" @click="row = 1">周记</button>
      <span class="jv-hint">滚轮在这两条藤之间切换</span>

      <span class="jv-spacer"></span>
      <button
        v-if="selDay"
        class="jv-act"
        @click="openDay(selDay.date)"
      >
        {{ selDay.has ? '进入这天的日记' : '写这天的日记' }}
      </button>
      <button v-else-if="selWeek" class="jv-act" @click="openWeek(selWeek)">
        {{ selWeek.noteId ? '打开这周的周记' : '写这周的周记' }}
      </button>
    </div>

    <transition name="jv-fade" mode="out-in">
      <!-- 每日日记 -->
      <div v-if="row === 0" key="day" class="jv-track" :style="{ '--n': dayNodes.length }">
        <svg class="jv-line" viewBox="0 0 700 26" preserveAspectRatio="none">
          <path d="M0 13 C 58 3, 117 23, 175 13 S 292 3, 350 13 S 467 23, 525 13 S 642 3, 700 13" />
        </svg>
        <div
          v-for="(d, i) in dayNodes"
          :key="d.date"
          class="jv-cell"
          :class="{ even: i % 2 === 0 }"
        >
          <span class="jv-stem"></span>
          <button
            class="jv-node"
            :class="{ empty: !d.has, on: selKey === d.date }"
            :title="`${d.date} 周${weekdayOf(d.date)}`"
            :style="d.mood ? { '--mood': MOOD_META[d.mood as 'ok'].color } : undefined"
            @click="pickDay(d)"
            @dblclick="openDay(d.date)"
          >
            <template v-if="d.has">
              <span class="jv-num">{{ dayNum(d.date) }}</span>
            </template>
            <span v-else class="jv-plus">＋</span>
          </button>
          <div class="jv-meta">
            <span class="jv-wd">周{{ weekdayOf(d.date) }}</span>
            <span class="jv-icons">
              <AppIcon v-if="d.weather" :name="d.weather" :size="12" />
              <AppIcon v-if="d.mood" :name="`mood-${d.mood}`" :size="12" />
            </span>
            <span class="jv-preview">{{ d.has ? d.preview || '已写' : '还没写' }}</span>
          </div>
        </div>
      </div>

      <!-- 周记 -->
      <div v-else key="week" class="jv-track" :style="{ '--n': weekNodes.length }">
        <svg class="jv-line" viewBox="0 0 700 26" preserveAspectRatio="none">
          <path d="M0 13 C 58 3, 117 23, 175 13 S 292 3, 350 13 S 467 23, 525 13 S 642 3, 700 13" />
        </svg>
        <div
          v-for="(w, i) in weekNodes"
          :key="w.start"
          class="jv-cell"
          :class="{ even: i % 2 === 0 }"
        >
          <span class="jv-stem"></span>
          <button
            class="jv-node"
            :class="{ empty: !w.noteId, on: selKey === w.start }"
            @click="pickWeek(w)"
            @dblclick="openWeek(w)"
          >
            <span v-if="w.noteId" class="jv-num sm">{{ w.label.replace('第 ', '').replace(' 周', '') }}</span>
            <span v-else class="jv-plus">＋</span>
          </button>
          <div class="jv-meta">
            <span class="jv-wd">{{ w.label }}</span>
            <span class="jv-preview">{{ w.noteId ? w.title : '还没写' }}</span>
          </div>
        </div>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.jvine {
  margin-top: 0.9rem;
  padding: 0.7rem 0.9rem 0.9rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
}
.jv-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 0.5rem;
}
.jv-tab {
  font-family: var(--font-display);
  font-size: 0.86rem;
  padding: 0.22rem 0.75rem;
  border: 2px solid var(--border);
  border-radius: 11px;
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  box-shadow: 0 2px 0 var(--surface-2);
  transition:
    transform 0.14s ease,
    border-color 0.14s ease,
    color 0.14s ease,
    background-color 0.14s ease;
}
.jv-tab:hover {
  transform: translateY(-1px);
  border-color: var(--accent);
  color: var(--accent);
}
.jv-tab.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  box-shadow: 0 2px 0 var(--accent-soft);
}
.jv-hint {
  font-size: 0.72rem;
  color: var(--text-3);
  margin-left: 0.2rem;
}
.jv-spacer {
  flex: 1;
}
.jv-act {
  font-family: var(--font-display);
  font-size: 0.86rem;
  padding: 0.26rem 0.9rem;
  border: 2px solid var(--accent);
  border-radius: 12px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 3px 0 var(--accent-soft);
  animation: jvPop 0.22s ease;
}
@keyframes jvPop {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
}
.jv-track {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  padding-top: 6px;
}
.jv-line {
  position: absolute;
  top: 16px;
  left: 4%;
  width: 92%;
  height: 26px;
  pointer-events: none;
}
.jv-line path {
  fill: none;
  stroke: rgba(120, 160, 130, 0.6);
  stroke-width: 2.5;
  stroke-linecap: round;
}
.jv-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding-top: 22px;
}
/* 果柄：从藤上斜着垂到葡萄 */
.jv-stem {
  width: 2px;
  height: 12px;
  background: rgba(120, 160, 130, 0.5);
  border-radius: 2px;
}
.jv-cell.even .jv-stem {
  height: 8px;
}
.jv-node {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--accent);
  background: var(--surface);
  color: var(--accent);
  cursor: pointer;
  font-family: var(--font-num);
  font-weight: 700;
  font-size: 0.95rem;
  transition: transform 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
}
.jv-node:hover {
  transform: translateY(-2px);
}
.jv-node.on {
  transform: scale(1.14);
  box-shadow: 0 0 0 4px var(--accent-soft);
}
/* 写过日记的：实心，心情决定颜色 */
.jv-node:not(.empty) {
  background: var(--mood, var(--accent));
  border-color: var(--mood, var(--accent));
  color: #fff;
}
/* 没写的：虚线圈 + 加号 */
.jv-node.empty {
  border-style: dashed;
  border-color: var(--text-3);
  color: var(--text-3);
  background: transparent;
}
.jv-node.empty:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.jv-plus {
  font-size: 1.05rem;
  line-height: 1;
}
.jv-num.sm {
  font-size: 0.82rem;
}
.jv-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  max-width: 100%;
  text-align: center;
}
.jv-wd {
  font-size: 0.7rem;
  color: var(--text-3);
}
.jv-icons {
  display: inline-flex;
  gap: 2px;
  color: var(--text-3);
}
.jv-preview {
  font-size: 0.66rem;
  color: var(--text-3);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.jv-fade-enter-active,
.jv-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.jv-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.jv-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
