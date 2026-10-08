<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSeasonsStore, derivePhase } from '../stores/seasons'
import { useJournalIndexStore } from '../stores/journalIndex'
import { useTasksStore } from '../stores/tasks'
import { toDateStr } from '../utils/helpers'
import AppIcon from '../components/AppIcon.vue'

const emit = defineEmits<{ teleport: [date: string, target: 'journal' | 'calendar'] }>()

const seasonsStore = useSeasonsStore()
const journalIndex = useJournalIndexStore()
const tasksStore = useTasksStore()

const hovered = ref<string | null>(null)

const W = 1000
const H = 460
const X0 = 90
const X1 = 930
const MAIN_Y = 300
const PEAK_UP = 150
const PEAK_DOWN = 430

onMounted(async () => {
  await seasonsStore.load()
  await journalIndex.load()
  if (!tasksStore.loaded) await tasksStore.load()
})

const range = computed(() => {
  const s = seasonsStore.seasons
  if (s.length === 0) return null
  const times = s.flatMap((x) => [new Date(x.start).getTime(), new Date(x.end).getTime()])
  return { min: Math.min(...times), max: Math.max(...times) }
})

function xOf(date: string): number {
  const r = range.value
  if (!r) return X0
  if (r.max === r.min) return (X0 + X1) / 2
  const t = new Date(date).getTime()
  return X0 + ((t - r.min) / (r.max - r.min)) * (X1 - X0)
}

const mainSeasons = computed(() =>
  seasonsStore.seasons.filter((s) => s.type === 'main').sort((a, b) => (a.start < b.start ? -1 : 1))
)

const sideSeasons = computed(() =>
  seasonsStore.seasons
    .filter((s) => s.type === 'side')
    .sort((a, b) => (a.start < b.start ? -1 : 1))
    .map((s, i) => ({
      ...s,
      up: i % 2 === 0,
      peak: i % 2 === 0 ? PEAK_UP : PEAK_DOWN
    }))
)

/** 二次贝塞尔在 t 处的 y */
function arcY(peak: number, t: number): number {
  const a = MAIN_Y
  return (1 - t) * (1 - t) * a + 2 * (1 - t) * t * peak + t * t * a
}

interface Anchor {
  date: string
  x: number
  y: number
  hasJournal: boolean
  seasonName: string
}

const anchors = computed<Anchor[]>(() => {
  const out: Anchor[] = []
  for (const e of journalIndex.entries) {
    if (e.date < (range.value ? toDateStr(new Date(range.value.min)) : '0000-00-00')) continue
    if (e.date > (range.value ? toDateStr(new Date(range.value.max)) : '9999-99-99')) continue
    const x = xOf(e.date)
    const side = sideSeasons.value.find((s) => e.date >= s.start && e.date <= s.end)
    if (side) {
      const xs = xOf(side.start)
      const xe = xOf(side.end)
      const t = xe > xs ? (x - xs) / (xe - xs) : 0.5
      out.push({ date: e.date, x, y: arcY(side.peak, Math.max(0, Math.min(1, t))), hasJournal: true, seasonName: side.name })
      continue
    }
    const main = mainSeasons.value.find((s) => e.date >= s.start && e.date <= s.end)
    out.push({ date: e.date, x, y: MAIN_Y, hasJournal: true, seasonName: main?.name ?? '季外' })
  }
  return out
})

const today = toDateStr(new Date())
const todayX = computed(() => (range.value ? xOf(today) : null))

function teleport(a: Anchor): void {
  emit('teleport', a.date, a.hasJournal ? 'journal' : 'calendar')
}

const phaseOf = derivePhase
</script>

<template>
  <div class="quest-map">
    <header class="view-head">
      <div>
        <h2>主线 / 支线地图</h2>
        <p class="sub">主线沿中轴推进，支线向外展开；圆点是传送锚点，点它回到当天的日记</p>
      </div>
    </header>

    <div v-if="seasonsStore.seasons.length === 0" class="empty">
      还没有赛季。去「赛季」创建一条主线（如：大一上学期）和一条支线（如：寒假），这里就会长出地图。
    </div>

    <template v-else>
      <div class="legend">
        <span class="lg"><i class="main-dot"></i>主线</span>
        <span class="lg"><i class="side-dot"></i>支线</span>
        <span class="lg"><i class="anchor-dot"></i>传送锚点</span>
        <span class="stat">{{ seasonsStore.seasons.length }} 条线 · {{ anchors.length }} 个锚点</span>
      </div>

      <svg class="canvas" :viewBox="`0 0 ${W} ${H}`">
        <defs>
          <linearGradient id="mainGrad" x1="0" x2="1">
            <stop offset="0%" stop-color="#c9564a" stop-opacity="0.35" />
            <stop offset="50%" stop-color="#c9564a" />
            <stop offset="100%" stop-color="#c9564a" stop-opacity="0.35" />
          </linearGradient>
        </defs>

        <!-- 主线中轴 -->
        <line :x1="X0" :y1="MAIN_Y" :x2="X1" :y2="MAIN_Y" class="axis" />

        <!-- 主线赛季段 -->
        <g v-for="s in mainSeasons" :key="s.id">
          <line
            :x1="xOf(s.start)"
            :y1="MAIN_Y"
            :x2="xOf(s.end)"
            :y2="MAIN_Y"
            class="main-seg"
            :class="{ active: phaseOf(s.start, s.end) === '进行中' }"
          />
          <text :x="(xOf(s.start) + xOf(s.end)) / 2" :y="MAIN_Y - 16" text-anchor="middle" class="seg-label">
            {{ s.name }}
          </text>
          <text :x="(xOf(s.start) + xOf(s.end)) / 2" :y="MAIN_Y + 26" text-anchor="middle" class="seg-meta">
            {{ s.start }} ~ {{ s.end }} · {{ phaseOf(s.start, s.end) }}
          </text>
        </g>

        <!-- 支线弧 -->
        <g v-for="s in sideSeasons" :key="s.id">
          <path
            :d="`M ${xOf(s.start)} ${MAIN_Y} Q ${(xOf(s.start) + xOf(s.end)) / 2} ${s.peak} ${xOf(s.end)} ${MAIN_Y}`"
            class="side-arc"
          />
          <text
            :x="(xOf(s.start) + xOf(s.end)) / 2"
            :y="s.up ? s.peak - 12 : s.peak + 20"
            text-anchor="middle"
            class="seg-label side"
          >
            {{ s.name }}
          </text>
        </g>

        <!-- 今天 -->
        <g v-if="todayX !== null">
          <line :x1="todayX" :y1="60" :x2="todayX" :y2="H - 40" class="today-line" />
          <text :x="todayX" y="50" text-anchor="middle" class="today-label">今天</text>
        </g>

        <!-- 传送锚点 -->
        <g
          v-for="a in anchors"
          :key="a.date"
          class="anchor"
          :class="{ hovered: hovered === a.date }"
          :transform="`translate(${a.x} ${a.y})`"
          @mouseenter="hovered = a.date"
          @mouseleave="hovered = null"
          @click="teleport(a)"
        >
          <circle r="12" class="anchor-halo" />
          <circle r="5.5" class="anchor-core" />
          <text
            v-if="hovered === a.date"
            :y="a.y > MAIN_Y ? 30 : -22"
            text-anchor="middle"
            class="anchor-tip"
          >
            {{ a.date }} · 日记
          </text>
        </g>
      </svg>

      <p class="tip">
        <AppIcon name="guide" :size="14" />
        悬停锚点看日期，点击直接跳到那天的日记；主线越活跃（进行中）会高亮。
      </p>
    </template>
  </div>
</template>

<style scoped>
.legend {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
  font-size: 0.82rem;
  color: var(--text-2);
}
.lg {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}
.lg i {
  width: 12px;
  height: 4px;
  border-radius: 2px;
  display: inline-block;
}
.main-dot {
  background: var(--accent);
}
.side-dot {
  background: #55a89f;
}
.anchor-dot {
  width: 9px !important;
  height: 9px !important;
  border-radius: 50% !important;
  background: #5b8def;
}
.stat {
  margin-left: auto;
  color: var(--text-3);
}
.canvas {
  width: 100%;
  height: auto;
  background: var(--surface);
  border-radius: 14px;
  box-shadow: var(--shadow);
}
.axis {
  stroke: var(--border);
  stroke-width: 2;
}
.main-seg {
  stroke: var(--accent);
  stroke-width: 6;
  stroke-linecap: round;
  opacity: 0.55;
}
.main-seg.active {
  opacity: 1;
  filter: drop-shadow(0 0 8px rgba(207, 74, 60, 0.55));
}
.side-arc {
  fill: none;
  stroke: #55a89f;
  stroke-width: 3;
  stroke-dasharray: 7 6;
  opacity: 0.85;
}
.seg-label {
  font-family: var(--font-display);
  font-size: 15px;
  fill: var(--text);
}
.seg-label.side {
  fill: #3d827a;
}
.seg-meta {
  font-size: 11px;
  fill: var(--text-3);
}
.today-line {
  stroke: var(--danger);
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
  opacity: 0.7;
}
.today-label {
  font-size: 11px;
  fill: var(--danger);
}
.anchor {
  cursor: pointer;
}
.anchor-halo {
  fill: transparent;
  transition: fill 0.15s ease;
}
.anchor:hover .anchor-halo {
  fill: rgba(91, 141, 239, 0.2);
}
.anchor-core {
  fill: #5b8def;
  stroke: var(--surface);
  stroke-width: 2;
  transition: r 0.15s ease;
}
.anchor:hover .anchor-core {
  r: 7.5;
}
.anchor-tip {
  font-size: 11px;
  fill: var(--text-2);
}
.tip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-3);
  font-size: 0.8rem;
  margin-top: 0.75rem;
}
</style>
