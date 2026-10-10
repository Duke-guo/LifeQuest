<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useJournalIndexStore } from '../stores/journalIndex'
import { useWeeklyJournalStore } from '../stores/weeklyJournal'
import { useSemesterStore } from '../stores/semester'
import { toDateStr } from '../utils/helpers'
import WeeklyJournalModal from './WeeklyJournalModal.vue'

interface DayColorLike {
  bg: string
  chipBg: string
  chipFg: string
  line: string
}

const props = defineProps<{
  /** 整段日带（连续，可能跨很多周）；和上面日历共用同一套列位置与偏移 */
  days: string[]
  /** 每天的左边界与宽度（宽度按内容变，所以由日历算好传进来） */
  lefts: number[]
  widths: number[]
  offset: number
  /** 日带视口正中对应的连续天序号（小数）：周记那行用它换算速度 */
  centerIndex: number
  /** 与日历格子同源的配色 */
  colors?: Record<string, DayColorLike>
  /** 这一段的第一天 */
  start: string
}>()
const emit = defineEmits<{ openJournal: [date: string]; openNote: [id: string] }>()

const journalIndex = useJournalIndexStore()
const weekly = useWeeklyJournalStore()
const semesterStore = useSemesterStore()
const showWeekEditor = ref(false)
const editingWeek = ref<{ start: string; end: string; label: string } | null>(null)

/** 0 = 每日日记，1 = 周记 */
const row = ref(0)

// ---------- 藤、果柄、果实共用一套坐标 ----------
const totalW = computed(() => {
  const n = props.days.length
  if (!n) return 1
  return props.lefts[n - 1] + props.widths[n - 1]
})

const VINE_BASE = 13
const VINE_AMP = 5
const FRUIT_TOP = 34
const FRUIT_SIZE = 34
const TRACK_H = 100

/** 周记那行：果实挨着排，一格一周 */
const WEEK_PITCH = 56
/** 周序号基准（必须是周日）：每周一个全局编号，和日带窗口无关，所以滚动不会跳 */
const WEEK_EPOCH = '2020-01-05'
function epochDays(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [ey, em, ed] = WEEK_EPOCH.split('-').map(Number)
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(ey, em - 1, ed).getTime()) / 86400000)
}
function sundayOfIndex(g: number): string {
  const [ey, em, ed] = WEEK_EPOCH.split('-').map(Number)
  return toDateStr(new Date(ey, em - 1, ed + g * 7))
}
/** 这一行往前后各渲染多少周（保证屏幕永远是满的，新的周从边上滑进来） */
const WEEK_SPAN = 22

/** 主藤的走势：一条连续藤穿过所有天（把每周连成一个整体） */
function vineY(x: number): number {
  return VINE_BASE + VINE_AMP * Math.sin((x / 320) * Math.PI * 2)
}
function canePath(width: number, y: (x: number) => number): string {
  const pts: string[] = []
  for (let x = 0; x <= width; x += 8) pts.push(`${x} ${y(x).toFixed(1)}`)
  return `M ${pts.join(' L ')}`
}
const vinePath = computed(() => canePath(totalW.value, vineY))

/** 周记行的藤：波长跟果实间距配套（两个果实一个波），看起来和上面那条一个调子 */
function weekVineY(gx: number): number {
  return VINE_BASE + VINE_AMP * Math.sin((gx / (WEEK_PITCH * 2)) * Math.PI * 2)
}

function dayCenterX(i: number): number {
  return props.lefts[i] + props.widths[i] / 2
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
    const x = dayCenterX(i)
    const sx = x - props.offset
    if (sx < -props.widths[i] || sx > 2200) continue
    out.push({ key: i, d: tendril(x, vineY(x), FRUIT_TOP, i % 2 === 0 ? -1 : 1) })
  }
  return out
})

onMounted(async () => {
  await journalIndex.load()
  if (!weekly.loaded) await weekly.load()
  if (!semesterStore.semester.start) await semesterStore.load()
  measure()
  window.addEventListener('resize', measure)
  // 进场动画/字体迟到会让第一次量到的不准，错开再量几次
  for (const ms of [150, 600, 1500]) window.setTimeout(measure, ms)
})

onUnmounted(() => window.removeEventListener('resize', measure))

/** 周记那一行的视口宽度：果实要落在它自己这行的正中 */
const viewportRef = ref<HTMLElement | null>(null)
const viewportW = ref(1000)
function measure(): void {
  const w = viewportRef.value?.clientWidth
  if (w) viewportW.value = w
}

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

/** 周记：一周一颗果实，果实之间挨着排（按全局周序号定位，窗口怎么变都不跳） */
interface WeekNode {
  g: number
  /** 在这一行里的横向坐标（像素） */
  x: number
  start: string
  end: string
  label: string
  short: string
  has: boolean
  isCurrent: boolean
}

/** 日带正中对应的连续周序号（小数） */
const centerWeekFloat = computed(() => {
  const n = props.days.length
  if (!n) return 0
  const idx = Math.max(0, Math.min(n - 1, Math.floor(props.centerIndex)))
  const frac = props.centerIndex - idx
  return (epochDays(props.days[idx]) + frac) / 7
})

/** 这一行当前渲染的周区间（以屏幕正中那一周为中心，前后各铺满 SPAN 周） */
const weekWin = computed(() => {
  const c = Math.round(centerWeekFloat.value)
  return { first: c - WEEK_SPAN, last: c + WEEK_SPAN }
})

const WEEK_ROWS = WEEK_SPAN * 2 + 1
const weekW = computed(() => WEEK_ROWS * WEEK_PITCH)
/** 轨道左边界的全局像素（用来把局部坐标换回全局，藤的相位才不会随窗口跳） */
const weekX0 = computed(() => weekWin.value.first * WEEK_PITCH)

const weekVinePath = computed(() =>
  canePath(weekW.value, (lx) => weekVineY(weekX0.value + lx))
)

const weekNodes = computed<WeekNode[]>(() => {
  const out: WeekNode[] = []
  for (let k = 0; k < WEEK_ROWS; k++) {
    const g = weekWin.value.first + k
    const start = sundayOfIndex(g)
    const end = shiftDate(start, 6)
    const wk = semesterStore.weekOf(start)
    out.push({
      g,
      x: g * WEEK_PITCH + WEEK_PITCH / 2,
      start,
      end,
      label: wk ? `第 ${wk} 周` : `${start.slice(5)} 起`,
      short: wk ? String(wk) : '＋',
      has: weekly.has(start),
      isCurrent: today >= start && today <= end
    })
  }
  return out
})

/**
 * 周记行的偏移：日带正中落在某一周的中间那天时，这一周的果实正好在这一行的正中。
 * 上面滚一周（7 天）→ 这里正好走一格，滚动速度是上面的 1/7。
 */
const weekOffset = computed(
  () => centerWeekFloat.value * WEEK_PITCH + WEEK_PITCH / 2 - viewportW.value / 2
)

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

/** 屏幕坐标 → 是否可见（只渲染看得见的那几十颗） */
function visibleDay(index: number): boolean {
  const sx = dayCenterX(index) - props.offset
  return sx > -props.widths[index] && sx < 2000
}
</script>

<template>
  <section class="jvine">
    <div class="jv-bar">
      <button class="jv-tab" :class="{ on: row === 0 }" @click="row = 0">每日日记</button>
      <button class="jv-tab" :class="{ on: row === 1 }" @click="row = 1">周记</button>
    </div>

    <div ref="viewportRef" class="jv-viewport">
      <!-- 每日日记：一天一颗，位置和上面日带一一对应 -->
      <div
        v-if="row === 0"
        class="jv-track"
        :style="{ width: totalW + 'px', transform: `translateX(${-offset}px)` }"
      >
        <svg class="jv-svg" :viewBox="`0 0 ${totalW} ${TRACK_H}`" preserveAspectRatio="none">
          <path class="vine-cane" :d="vinePath" />
          <path v-for="s in stems" :key="`s${s.key}`" class="vine-twig" :d="s.d" />
        </svg>
        <div
          v-for="d in dayNodes"
          v-show="visibleDay(d.index)"
          :key="d.date"
          class="jv-cell"
          :style="{ left: dayCenterX(d.index) + 'px', width: 0 }"
        >
          <span v-if="d.isSunday && d.weekNo" class="jv-week-no">第{{ d.weekNo }}周</span>
          <button
            class="jv-node vine-fruit"
            :class="{ empty: !d.has, current: d.date === today }"
            :style="{ ...(d.has ? fruitStyle(d.date) : {}), '--tilt': tilt(d.date) }"
            :title="`${d.date} 周${weekdayOf(d.date)}（点击进入日记）`"
            @click="openDay(d.date)"
          >
            <span v-if="d.has" class="jv-num">{{ dayNum(d.date) }}</span>
            <span v-else class="jv-plus">＋</span>
          </button>
        </div>
      </div>

      <!-- 周记：一周一颗，果实挨着排；速度是上面日带的 1/7，整行一直铺满，新的周从边上滑进来 -->
      <div
        v-else
        class="jv-track"
        :data-center-week="centerWeekFloat.toFixed(3)"
        :data-week-offset="weekOffset.toFixed(1)"
        :style="{
          width: weekW + 'px',
          transform: `translateX(${-(weekOffset - weekX0)}px)`
        }"
      >
        <svg class="jv-svg" :viewBox="`0 0 ${weekW} ${TRACK_H}`" preserveAspectRatio="none">
          <path class="vine-cane" :d="weekVinePath" />
          <path
            v-for="w in weekNodes"
            :key="`t${w.g}`"
            class="vine-twig"
            :d="tendril(w.x - weekX0, weekVineY(w.x), FRUIT_TOP, w.g % 2 === 0 ? -1 : 1)"
          />
        </svg>
        <div
          v-for="w in weekNodes"
          :key="w.g"
          class="jv-cell"
          :style="{ left: w.x - weekX0 + 'px', width: 0 }"
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
        </div>
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
  padding: 0.7rem 0 0.55rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
}
.jv-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 0.35rem;
  padding: 0 0.9rem;
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

/* 连续藤：整段横向滑动，和上面的日带共用同一个偏移（左右不留内边距，保证与日带对得齐） */
.jv-viewport {
  position: relative;
  height: 108px;
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
  height: 108px;
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
  padding-top: 34px;
}
.jv-week-no {
  position: absolute;
  top: 2px;
  left: -44px;
  width: 88px;
  text-align: center;
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
</style>
