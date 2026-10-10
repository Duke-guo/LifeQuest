<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useJournalIndexStore } from '../stores/journalIndex'
import { useWeeklyJournalStore } from '../stores/weeklyJournal'
import { useSemesterStore } from '../stores/semester'
import { toDateStr } from '../utils/helpers'
import AppIcon from './AppIcon.vue'
import WeeklyJournalModal from './WeeklyJournalModal.vue'

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
const weekly = useWeeklyJournalStore()
const showWeekEditor = ref(false)
const editingWeek = ref<{ start: string; end: string; label: string } | null>(null)
const semesterStore = useSemesterStore()

/** 0 = 每日日记，1 = 周记；滚轮切换，一次只显示一条 */
const row = ref(0)
const selKey = ref<string | null>(null)
let lock = 0

// ---------- 藤、果柄、果实共用一套坐标 ----------
const VW = 700
const VINE_BASE = 13
const VINE_AMP = 5
const FRUIT_TOP = 34 // 果实顶端；离藤很近
const FRUIT_SIZE = 34
const ENTRY_TOP = 72
const ENTRY_SIZE = 26
const TRACK_H = ENTRY_TOP + ENTRY_SIZE + 6

/** 主藤的走势 */
function vineY(x: number): number {
  return VINE_BASE + VINE_AMP * Math.sin((x / VW) * Math.PI * 4)
}

const vinePath = computed(() => {
  const pts: string[] = []
  for (let x = 0; x <= VW; x += 6) pts.push(`${x} ${vineY(x).toFixed(1)}`)
  return `M ${pts.join(' L ')}`
})

function colX(i: number, n: number): number {
  return Math.round(((i + 0.5) * VW) / n)
}

/** 果柄：一条微微打弯的小枝（左右交替，乱中有序），从藤上垂到果实顶 */
function tendril(x: number, y1: number, y2: number, dir: number): string {
  const drop = y2 - y1
  const bow = dir * Math.min(9, drop * 0.42)
  return `M ${x} ${y1.toFixed(1)} C ${(x + bow).toFixed(1)} ${(y1 + drop * 0.4).toFixed(1)}, ${(
    x - bow * 0.7
  ).toFixed(1)} ${(y1 + drop * 0.75).toFixed(1)}, ${x} ${y2}`
}

interface StemPath {
  key: number
  d: string
}
function stems(n: number): StemPath[] {
  const out: StemPath[] = []
  for (let i = 0; i < n; i++) {
    const x = colX(i, n)
    out.push({ key: i, d: tendril(x, vineY(x), FRUIT_TOP, i % 2 === 0 ? -1 : 1) })
  }
  return out
}

/** 入口果实的小枝：从果实底部垂下来 */
function entryTendril(i: number, n: number): string {
  const x = colX(i, n)
  const dir = i % 2 === 0 ? 1 : -1
  return tendril(x, FRUIT_TOP + FRUIT_SIZE, ENTRY_TOP, dir)
}

onMounted(async () => {
  await journalIndex.load()
  if (!weekly.loaded) await weekly.load()
  if (!semesterStore.semester.start) await semesterStore.load()
})

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
const today = toDateStr(new Date())

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

interface WeekNode {
  start: string
  end: string
  label: string
  short: string
  /** 这周写了周记没有 */
  has: boolean
  /** 相对本周的位置：0 = 本周，-2/-1 过去，+1/+2 将来 */
  offset: number
}

/** 以当前周为中心：左两周边（过去）→ 本周 → 右两周（将来），时间向右延伸 */
const weekNodes = computed<WeekNode[]>(() => {
  const out: WeekNode[] = []
  for (let off = -2; off <= 2; off++) {
    const start = shiftDate(props.weekStart, 7 * off)
    const end = shiftDate(props.weekEnd, 7 * off)
    const wk = semesterStore.weekOf(start)
    out.push({
      start,
      end,
      offset: off,
      label: off === 0 ? `本周 · 第 ${wk ?? '—'} 周` : wk ? `第 ${wk} 周` : `${start.slice(5)} 起`,
      short: wk ? String(wk) : '＋',
      has: weekly.has(start)
    })
  }
  return out
})

/** 离本周越远越小越淡 */
function nodeScale(offset: number): number {
  const d = Math.abs(offset)
  return d === 0 ? 1.32 : d === 1 ? 1 : 0.82
}
function nodeOpacity(offset: number): number {
  const d = Math.abs(offset)
  return d === 0 ? 1 : d === 1 ? 0.78 : 0.5
}

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

/** 每颗果实一点点歪，乱中有序（与笔记葡萄藤一致） */
function tilt(date: string): string {
  let h = 0
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) | 0
  return `${(((Math.abs(h) % 100) / 100) * 6 - 3).toFixed(1)}deg`
}

/** 果实用当天配色（和上面日历同源） */
function fruitStyle(date: string): Record<string, string> | undefined {
  const c = props.colors?.[date]
  if (!c) return undefined
  return { background: c.chipBg, color: c.chipFg, boxShadow: `0 0 0 2px ${c.line}` }
}
/** 入口果实：同色系再深一档，像同一串上的第二颗 */
function entryStyle(date: string): Record<string, string> {
  const c = props.colors?.[date]
  if (!c) return { background: 'var(--accent)', color: '#fff' }
  return { background: c.line, color: '#fff' }
}

function openDay(date: string): void {
  emit('openJournal', date)
}

/** 打开这一周的周记（和日记同一个模块，存在 journal/w<周日>.md） */
function openWeek(w: WeekNode): void {
  editingWeek.value = { start: w.start, end: w.end, label: w.label }
  showWeekEditor.value = true
}
</script>

<template>
  <section class="jvine" @wheel="onWheel">
    <div class="jv-bar">
      <button class="jv-tab" :class="{ on: row === 0 }" @click="row = 0">每日日记</button>
      <button class="jv-tab" :class="{ on: row === 1 }" @click="row = 1">周记</button>
      <span class="jv-hint">滚轮换藤 · 点果实长出入口</span>
    </div>

    <transition name="jv-fade" mode="out-in">
      <!-- 每日日记 -->
      <div v-if="row === 0" key="day" class="jv-track" :style="{ '--n': dayNodes.length }">
        <svg class="jv-svg" :viewBox="`0 0 ${VW} ${TRACK_H}`" preserveAspectRatio="none">
          <path class="vine-cane" :d="vinePath" />
          <path v-for="s in stems(dayNodes.length)" :key="`s${s.key}`" class="vine-twig" :d="s.d" />
          <path
            v-for="(d, i) in dayNodes"
            v-show="selKey === d.date"
            :key="`e${d.date}`"
            class="vine-twig on"
            :d="entryTendril(i, dayNodes.length)"
          />
        </svg>

        <div v-for="d in dayNodes" :key="d.date" class="jv-cell">
          <button
            class="jv-node vine-fruit"
            :class="{ empty: !d.has, on: selKey === d.date, current: d.date === today }"
            :style="{
              ...(d.has ? fruitStyle(d.date) : {}),
              '--tilt': tilt(d.date),
              '--scale': d.date === today ? 1.3 : 1
            }"
            :title="`${d.date} 周${weekdayOf(d.date)}（点击进入日记）`"
            @click="openDay(d.date)"
          >
            <span v-if="d.has" class="jv-num">{{ dayNum(d.date) }}</span>
            <span v-else class="jv-plus">＋</span>
          </button>

          <span class="vine-label" :class="{ on: selKey === d.date }">周{{ weekdayOf(d.date) }}</span>
        </div>
      </div>

      <!-- 周记 -->
      <div v-else key="week" class="jv-track" :style="{ '--n': weekNodes.length }">
        <svg class="jv-svg" :viewBox="`0 0 ${VW} ${TRACK_H}`" preserveAspectRatio="none">
          <path class="vine-cane" :d="vinePath" />
          <path v-for="s in stems(weekNodes.length)" :key="`s${s.key}`" class="vine-twig" :d="s.d" />
          <path
            v-for="(w, i) in weekNodes"
            v-show="selKey === w.start"
            :key="`e${w.start}`"
            class="vine-twig on"
            :d="entryTendril(i, weekNodes.length)"
          />
        </svg>

        <div v-for="w in weekNodes" :key="w.start" class="jv-cell">
          <button
            class="jv-node vine-fruit"
            :class="{ empty: !w.has, on: selKey === w.start, current: w.offset === 0 }"
            :style="{ '--tilt': tilt(w.start), '--scale': nodeScale(w.offset), opacity: nodeOpacity(w.offset) }"
            :title="`${w.start} ~ ${w.end}（点击打开周记）`"
            @click="openWeek(w)"
          >
            <span v-if="w.has" class="jv-num sm">{{ w.short }}</span>
            <span v-else class="jv-plus">＋</span>
          </button>

          <span class="vine-label" :class="{ on: selKey === w.start }">{{ w.label }}</span>
        </div>
      </div>
    </transition>

    <WeeklyJournalModal
      v-if="showWeekEditor && editingWeek"
      :week-start="editingWeek.start"
      :week-end="editingWeek.end"
      :label="editingWeek.label"
      @close="showWeekEditor = false"
    />
  </section>
</template>

<style scoped>
.jvine {
  margin-top: 0.9rem;
  padding: 0.7rem 0.9rem 0.55rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
}
.jv-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 0.1rem;
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

/* 藤 / 果柄 / 果实共用一层坐标（线条样式见 main.css 的 .vine-cane / .vine-twig） */
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
  height: 100px;
  overflow: visible;
  pointer-events: none;
}

.jv-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 与 SVG 的 FRUIT_TOP 对齐 */
  padding-top: 34px;
}
/* 葡萄：平面质感，与笔记葡萄藤一致（底色来自当天配色） */
.jv-node {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-family: var(--font-num);
  font-weight: 700;
  font-size: 0.92rem;
  transform: rotate(var(--tilt, 0deg)) scale(var(--scale, 1));
}
/* 没写的：淡虚线圈 + 加号 */
.jv-node.empty {
  background: transparent;
  border-style: dashed;
  color: var(--text-3);
  box-shadow: none;
  opacity: 0.85;
}
.jv-node.empty:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.jv-plus {
  font-size: 0.95rem;
  line-height: 1;
  opacity: 0.8;
}
.jv-num.sm {
  font-size: 0.8rem;
}

/* 入口果实：同一串上的第二颗，平面质感 */
.jv-entry-slot {
  height: 40px;
  display: flex;
  align-items: flex-start;
  padding-top: 6px;
}
.jv-entry {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(60, 30, 25, 0.18);
  animation: jvPop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  transition: transform 0.16s ease;
}
.jv-entry:hover {
  transform: translateY(-2px) scale(1.08);
}
@keyframes jvPop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
}
.jv-cell .vine-label {
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
