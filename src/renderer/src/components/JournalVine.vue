<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useJournalIndexStore } from '../stores/journalIndex'
import { useNotesStore } from '../stores/notes'
import { useSemesterStore } from '../stores/semester'
import { extendNote } from '../utils/noteActions'
import { toDateStr } from '../utils/helpers'
import AppIcon from './AppIcon.vue'

interface DayColorLike {
  bg: string
  chipBg: string
  chipFg: string
  line: string
}

const props = defineProps<{
  weekStart: string
  weekEnd: string
  days: string[]
  /** 与日历格子同源的配色（由日历传入，保证颜色一致） */
  colors?: Record<string, DayColorLike>
}>()
const emit = defineEmits<{ openJournal: [date: string]; openNote: [id: string] }>()

const journalIndex = useJournalIndexStore()
const notesStore = useNotesStore()
const semesterStore = useSemesterStore()

/** 0 = 每日日记，1 = 周记；滚轮切换，一次只显示一条 */
const row = ref(0)
const selKey = ref<string | null>(null)
let lock = 0

// ---------- 藤与果实的几何（同一套坐标，保证接得上、对得齐） ----------
const VW = 700 // viewBox 宽（横向拉伸到真实宽度，等分列）
const VINE_BASE = 16
const VINE_AMP = 6
const FRUIT_TOP = 64 // 果实顶端（px，与单元格 padding-top 一致）
const FRUIT_SIZE = 36
const ENTRY_TOP = FRUIT_TOP + FRUIT_SIZE + 12
const ENTRY_SIZE = 30
const TRACK_H = ENTRY_TOP + ENTRY_SIZE + 4

function vineY(x: number): number {
  return VINE_BASE + VINE_AMP * Math.sin((x / VW) * Math.PI * 4)
}

/** 藤本身：按同一函数采样，所以果柄起点一定落在藤上 */
const vinePath = computed(() => {
  const pts: string[] = []
  for (let x = 0; x <= VW; x += 8) pts.push(`${x} ${vineY(x).toFixed(1)}`)
  return `M ${pts.join(' L ')}`
})

function colX(i: number, n: number): number {
  return Math.round(((i + 0.5) * VW) / n)
}

/** 果柄：藤 → 果实顶端 */
function stems(n: number): Array<{ key: number; x: number; y1: number; y2: number }> {
  const out: Array<{ key: number; x: number; y1: number; y2: number }> = []
  for (let i = 0; i < n; i++) {
    const x = colX(i, n)
    out.push({ key: i, x, y1: Number(vineY(x).toFixed(1)), y2: FRUIT_TOP })
  }
  return out
}

/** 入口果实的短柄：果实底 → 入口果实顶端 */
function entryStem(i: number, n: number): { x: number; y1: number; y2: number } {
  const x = colX(i, n)
  return { x, y1: FRUIT_TOP + FRUIT_SIZE, y2: ENTRY_TOP }
}

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
}

const dayNodes = computed<DayNode[]>(() =>
  props.days.map((date) => {
    const j = journalIndex.on(date)
    const has = !!j && (j.hasContent || !!j.mood || !!j.weather)
    return { date, has }
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
  short: string
  noteId: string | null
}

/** 本周 + 往前 5 周，凑成一条周记藤 */
const weekNodes = computed<WeekNode[]>(() => {
  const out: WeekNode[] = []
  for (let i = 0; i < 6; i++) {
    const start = shiftDate(props.weekStart, -7 * i)
    const end = shiftDate(props.weekEnd, -7 * i)
    const wk = semesterStore.weekOf(start)
    out.push({
      start,
      end,
      label: wk ? `第 ${wk} 周` : `${start.slice(5)} 起`,
      short: wk ? String(wk) : '＋',
      noteId: weeklyNoteOf(start, end)
    })
  }
  return out
})

function onWheel(e: WheelEvent): void {
  e.preventDefault()
  const now = Date.now()
  if (now < lock) return
  lock = now + 320
  row.value = row.value === 0 ? 1 : 0
  selKey.value = null
}

function pick(key: string): void {
  selKey.value = selKey.value === key ? null : key
}

/** 果实颜色与日历格子同源 */
function fruitStyle(date: string): Record<string, string> | undefined {
  const c = props.colors?.[date]
  if (!c) return undefined
  return { background: c.chipBg, borderColor: c.line, color: c.chipFg }
}

function openDay(date: string): void {
  emit('openJournal', date)
}

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
      <button
        class="jv-tab"
        :class="{ on: row === 1 }"
        @click="row = 1"
      >
        周记
      </button>
      <span class="jv-hint">滚轮在这两条藤之间切换 · 点果实长出入口</span>
    </div>

    <transition name="jv-fade" mode="out-in">
      <!-- 每日日记 -->
      <div v-if="row === 0" key="day" class="jv-track" :style="{ '--n': dayNodes.length }">
        <svg class="jv-svg" :viewBox="`0 0 ${VW} ${TRACK_H}`" preserveAspectRatio="none">
          <path class="jv-vine" :d="vinePath" />
          <line
            v-for="s in stems(dayNodes.length)"
            :key="`s${s.key}`"
            class="jv-stem"
            :x1="s.x"
            :y1="s.y1"
            :x2="s.x"
            :y2="s.y2"
          />
          <template v-for="(d, i) in dayNodes" :key="`e${d.date}`">
            <line
              v-if="selKey === d.date"
              class="jv-stem entry"
              :x1="entryStem(i, dayNodes.length).x"
              :y1="entryStem(i, dayNodes.length).y1"
              :x2="entryStem(i, dayNodes.length).x"
              :y2="entryStem(i, dayNodes.length).y2"
            />
          </template>
        </svg>

        <div v-for="d in dayNodes" :key="d.date" class="jv-cell">
          <button
            class="jv-node"
            :class="{ empty: !d.has, on: selKey === d.date }"
            :style="d.has ? fruitStyle(d.date) : undefined"
            :title="`${d.date} 周${weekdayOf(d.date)}`"
            @click="pick(d.date)"
          >
            <span v-if="d.has" class="jv-num">{{ dayNum(d.date) }}</span>
            <span v-else class="jv-plus">＋</span>
          </button>

          <div class="jv-entry-slot">
            <button
              v-if="selKey === d.date"
              class="jv-entry"
              :title="d.has ? '进入这天的日记' : '写这天的日记'"
              @click="openDay(d.date)"
            >
              <AppIcon name="journal" :size="15" />
            </button>
          </div>

          <span class="jv-wd">周{{ weekdayOf(d.date) }}</span>
        </div>
      </div>

      <!-- 周记 -->
      <div v-else key="week" class="jv-track" :style="{ '--n': weekNodes.length }">
        <svg class="jv-svg" :viewBox="`0 0 ${VW} ${TRACK_H}`" preserveAspectRatio="none">
          <path class="jv-vine" :d="vinePath" />
          <line
            v-for="s in stems(weekNodes.length)"
            :key="`s${s.key}`"
            class="jv-stem"
            :x1="s.x"
            :y1="s.y1"
            :x2="s.x"
            :y2="s.y2"
          />
          <template v-for="(w, i) in weekNodes" :key="`e${w.start}`">
            <line
              v-if="selKey === w.start"
              class="jv-stem entry"
              :x1="entryStem(i, weekNodes.length).x"
              :y1="entryStem(i, weekNodes.length).y1"
              :x2="entryStem(i, weekNodes.length).x"
              :y2="entryStem(i, weekNodes.length).y2"
            />
          </template>
        </svg>

        <div v-for="w in weekNodes" :key="w.start" class="jv-cell">
          <button
            class="jv-node"
            :class="{ empty: !w.noteId, on: selKey === w.start }"
            :title="`${w.start} ~ ${w.end}`"
            @click="pick(w.start)"
          >
            <span v-if="w.noteId" class="jv-num sm">{{ w.short }}</span>
            <span v-else class="jv-plus">＋</span>
          </button>

          <div class="jv-entry-slot">
            <button
              v-if="selKey === w.start"
              class="jv-entry"
              :title="w.noteId ? '打开这周的周记' : '写这周的周记'"
              @click="openWeek(w)"
            >
              <AppIcon name="notes" :size="15" />
            </button>
          </div>

          <span class="jv-wd">{{ w.label }}</span>
        </div>
      </div>
    </transition>
  </section>
</template>

<style scoped>
.jvine {
  margin-top: 0.9rem;
  padding: 0.7rem 0.9rem 0.7rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
}
.jv-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 0.35rem;
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

/* 藤与果实共用的坐标层 */
.jv-track {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
}
.jv-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 140px;
  pointer-events: none;
}
.jv-vine {
  fill: none;
  stroke: rgba(110, 155, 120, 0.75);
  stroke-width: 2.5;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}
.jv-stem {
  stroke: rgba(110, 155, 120, 0.65);
  stroke-width: 2;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}
.jv-stem.entry {
  stroke: var(--accent);
  stroke-dasharray: 4 3;
}

.jv-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 与 SVG 的 FRUIT_TOP 对齐 */
  padding-top: 64px;
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
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}
.jv-node:hover {
  transform: translateY(-2px);
}
.jv-node.on {
  transform: scale(1.12);
  box-shadow: 0 0 0 4px var(--accent-soft);
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
  font-size: 0.84rem;
}

/* 入口果实的固定槽位（不显示时也占位，避免标签跳动） */
.jv-entry-slot {
  height: 42px;
  display: flex;
  align-items: flex-start;
  padding-top: 12px;
}
.jv-entry {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--accent);
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 3px 8px rgba(207, 74, 60, 0.28);
  animation: jvPop 0.2s ease;
  transition: transform 0.16s ease;
}
.jv-entry:hover {
  transform: translateY(-2px) scale(1.06);
}
@keyframes jvPop {
  from {
    transform: scale(0.5);
    opacity: 0;
  }
}
.jv-wd {
  font-size: 0.7rem;
  color: var(--text-3);
  margin-top: 2px;
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
