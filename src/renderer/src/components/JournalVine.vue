<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useJournalIndexStore } from '../stores/journalIndex'
import { useWeeklyJournalStore } from '../stores/weeklyJournal'
import { useSemesterStore } from '../stores/semester'
import { toDateStr, formatDate } from '../utils/helpers'
import AppIcon from './AppIcon.vue'
import WeeklyJournalModal from './WeeklyJournalModal.vue'

interface DayColorLike {
  bg: string
  chipBg: string
  chipFg: string
  line: string
}

const props = defineProps<{
  /** 整段日带（连续，可能跨很多周）；和上面日历共用同一套列宽与偏移 */
  days: string[]
  offset: number
  colWidth: number
  gap: number
  /** 与日历格子同源的配色（由日历传入，保证颜色一致） */
  colors?: Record<string, DayColorLike>
  /** 这一段的第一天（用来判断周界） */
  start: string
}>()
const emit = defineEmits<{ openJournal: [date: string]; openNote: [id: string] }>()

const journalIndex = useJournalIndexStore()
const weekly = useWeeklyJournalStore()
const semesterStore = useSemesterStore()
const showWeekEditor = ref(false)
const editingWeek = ref<{ start: string; end: string; label: string } | null>(null)

/** 0 = 每日日记，1 = 周记（点标签切换，滚轮留给横向滑动） */
const row = ref(0)

// ---------- 藤、果柄、果实共用一套坐标 ----------
const PITCH = computed(() => props.colWidth + props.gap)
const totalW = computed(() => Math.max(1, props.days.length * PITCH.value - props.gap))

const VINE_BASE = 13
const VINE_AMP = 5
const FRUIT_TOP = 34
const FRUIT_SIZE = 34
const TRACK_H = 106

/** 主藤的走势：一整条连续藤穿过所有天（把每周连成一个整体） */
function vineY(x: number): number {
  return VINE_BASE + VINE_AMP * Math.sin((x / 320) * Math.PI * 2)
}
const vinePath = computed(() => {
  const pts: string[] = []
  for (let x = 0; x <= totalW.value; x += 8) pts.push(`${x} ${vineY(x).toFixed(1)}`)
  return `M ${pts.join(' L ')}`
})

function colX(i: number): number {
  return i * PITCH.value + props.colWidth / 2
}

/** 果柄：一条微微打弯的小枝（左右交替，乱中有序），从藤上垂到果实顶 */
function tendril(x: number, y1: number, y2: number, dir: number): string {
  const drop = y2 - y1
  const bow = dir * Math.min(9, drop * 0.42)
  return `M ${x} ${y1.toFixed(1)} C ${(x + bow).toFixed(1)} ${(y1 + drop * 0.4).toFixed(1)}, ${(
    x - bow * 0.7
  ).toFixed(1)} ${(y1 + drop * 0.75).toFixed(1)}, ${x} ${y2}`
}

/** 只在屏幕上看得到的那几十天画果柄，省 DOM */
const stems = computed(() => {
  const out: Array<{ key: number; d: string }> = []
  for (let i = 0; i < props.days.length; i++) {
    const x = colX(i)
    const sx = x - props.offset
    if (sx < -props.colWidth || sx > 2200) continue
    out.push({ key: i, d: tendril(x, vineY(x), FRUIT_TOP, i % 2 === 0 ? -1 : 1) })
  }
  return out
})

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
  index: number
  has: boolean
  isSunday: boolean
  weekNo: number | null
}

const dayNodes = computed<DayNode[]>(() => {
  const [sy, sm, sd] = props.start.split('-').map(Number)
  const startDay = new Date(sy, sm - 1, sd).getDay()
  return props.days.map((date, i) => {
    const j = journalIndex.on(date)
    const has = !!j && (j.hasContent || !!j.mood || !!j.weather)
    const isSunday = (startDay + i) % 7 === 0
    return { date, index: i, has, isSunday, weekNo: isSunday ? semesterStore.weekOf(date) : null }
  })
})

/** 周记那一行：每周一颗果实，挂在那一周的周日位置上 */
interface WeekNode {
  start: string
  end: string
  label: string
  short: string
  has: boolean
  index: number
  isCurrent: boolean
}

const weekNodes = computed<WeekNode[]>(() => {
  const [sy, sm, sd] = props.start.split('-').map(Number)
  const startDay = new Date(sy, sm - 1, sd).getDay()
  // 这一段里第一个周日的位置
  const firstSunday = (7 - startDay) % 7
  const out: WeekNode[] = []
  for (let i = firstSunday; i < props.days.length; i += 7) {
    const start = props.days[i]
    const end = shiftDate(start, 6)
    const wk = semesterStore.weekOf(start)
    out.push({
      start,
      end,
      index: i,
      isCurrent: today >= start && today <= end,
      label: wk ? `第 ${wk} 周` : `${start.slice(5)} 起`,
      short: wk ? String(wk) : '＋',
      has: weekly.has(start)
    })
  }
  return out
})

/** 果实用当天配色（和上面日历同源） */
function fruitStyle(date: string): Record<string, string> | undefined {
  const c = props.colors?.[date]
  if (!c) return undefined
  return { background: c.chipBg, color: c.chipFg, boxShadow: `0 0 0 2px ${c.line}` }
}

/** 每颗果实一点点歪，乱中有序（与笔记葡萄藤一致） */
function tilt(date: string): string {
  let h = 0
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) | 0
  return `${(((Math.abs(h) % 100) / 100) * 6 - 3).toFixed(1)}deg`
}

function openDay(date: string): void {
  emit('openJournal', date)
}

/** 打开这一周的周记（和日记同一个模块，存在 journal/w<周日>.md） */
function openWeek(w: WeekNode): void {
  editingWeek.value = { start: w.start, end: w.end, label: w.label }
  showWeekEditor.value = true
}

/** 屏幕坐标 → 是否可见（只渲染看得见的那几十颗，70 天全渲染太重） */
function visible(index: number): boolean {
  const sx = colX(index) - props.offset
  return sx > -props.colWidth && sx < 2000
}
</script>

<template>
  <section class="jvine">
    <div class="jv-bar">
      <button class="jv-tab" :class="{ on: row === 0 }" @click="row = 0">每日日记</button>
      <button class="jv-tab" :class="{ on: row === 1 }" @click="row = 1">周记</button>
      <span class="jv-hint">和上面的日历同一条藤 · 滚轮左右滑 · 点果实进入</span>
    </div>

    <div class="jv-viewport">
      <div class="jv-track" :style="{ width: totalW + 'px', transform: `translateX(${-offset}px)` }">
        <svg class="jv-svg" :viewBox="`0 0 ${totalW} ${TRACK_H}`" preserveAspectRatio="none">
          <path class="vine-cane" :d="vinePath" />
          <path v-for="s in stems" :key="`s${s.key}`" class="vine-twig" :d="s.d" />
        </svg>

        <!-- 每日日记：一天一颗 -->
        <template v-if="row === 0">
          <div
            v-for="d in dayNodes"
            v-show="visible(d.index)"
            :key="d.date"
            class="jv-cell"
            :style="{ left: d.index * PITCH + 'px', width: colWidth + 'px' }"
          >
            <span v-if="d.isSunday && d.weekNo" class="jv-week-no">第{{ d.weekNo }}周</span>
            <button
              class="jv-node vine-fruit"
              :class="{ empty: !d.has, current: d.date === today }"
              :style="{ ...(d.has ? fruitStyle(d.date) : {}), '--tilt': tilt(d.date) }"
              :title="`${formatDate(d.date)} 周${weekdayOf(d.date)}（点击进入日记）`"
              @click="openDay(d.date)"
            >
              <span v-if="d.has" class="jv-num">{{ dayNum(d.date) }}</span>
              <span v-else class="jv-plus">＋</span>
            </button>
            <span class="vine-label">周{{ weekdayOf(d.date) }}</span>
          </div>
        </template>

        <!-- 周记：一周一颗，挂在那一周的周日上 -->
        <template v-else>
          <div
            v-for="w in weekNodes"
            v-show="visible(w.index)"
            :key="w.start"
            class="jv-cell"
            :style="{ left: w.index * PITCH + 'px', width: colWidth + 'px' }"
          >
            <span class="jv-week-no">{{ w.label }}</span>
            <button
              class="jv-node vine-fruit"
              :class="{ empty: !w.has, current: w.isCurrent }"
              :style="{ '--tilt': tilt(w.start) }"
              :title="`${w.start} ~ ${w.end}（点击打开周记）`"
              @click="openWeek(w)"
            >
              <span v-if="w.has" class="jv-num sm">{{ w.short }}</span>
              <span v-else class="jv-plus">＋</span>
            </button>
            <span class="vine-label">{{ w.start.slice(5) }}</span>
          </div>
        </template>
      </div>
    </div>

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

/* 连续藤：整段横向滑动，和上面的日带共用同一个偏移 */
.jv-viewport {
  position: relative;
  height: 106px;
  overflow: hidden;
}
.jv-track {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  will-change: transform;
}
.jv-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 106px;
  overflow: visible;
  pointer-events: none;
}

.jv-cell {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 与 SVG 的 FRUIT_TOP 对齐 */
  padding-top: 34px;
}
.jv-week-no {
  position: absolute;
  top: 0;
  font-size: 0.6rem;
  color: var(--text-3);
  font-family: var(--font-num);
  white-space: nowrap;
}
/* 葡萄：平面质感，与笔记葡萄藤一致（底色来自当天配色） */
.jv-node {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-family: var(--font-num);
  font-weight: 700;
  font-size: 0.92rem;
  transform: rotate(var(--tilt, 0deg));
}
.jv-node.current {
  transform: rotate(var(--tilt, 0deg)) scale(1.24);
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
.jv-cell .vine-label {
  margin-top: 2px;
}
</style>
