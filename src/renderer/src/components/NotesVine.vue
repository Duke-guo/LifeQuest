<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useNotesStore } from '../stores/notes'
import { useTasksStore } from '../stores/tasks'
import { useLinksStore } from '../stores/links'
import { subjectOfNote } from '../utils/noteSubject'
import { renderMarkdown } from '../utils/markdown'
import AppIcon from './AppIcon.vue'

const emit = defineEmits<{ open: [noteId: string] }>()

const notesStore = useNotesStore()
const tasksStore = useTasksStore()
const linksStore = useLinksStore()

type Mode = 'time' | 'subject'
const mode = ref<Mode>('time')
const activeCol = ref(0)
const activeNode = ref(0)

const containerRef = ref<HTMLElement | null>(null)
const containerW = ref(0)

const COL_W = 230
const H = 440
const NODE_H = 46
const TOP = 52
const BOTTOM = H - 22
const CX = COL_W / 2

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

onMounted(async () => {
  if (notesStore.notes.length === 0) await notesStore.list()
  if (tasksStore.tasks.length === 0) await tasksStore.load()
  if (linksStore.links.length === 0) await linksStore.load()
  measure()
  window.addEventListener('resize', measure)
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  window.removeEventListener('resize', measure)
  window.removeEventListener('keydown', onKey)
})

function measure(): void {
  containerW.value = containerRef.value?.clientWidth ?? 0
}

/** 确定性伪随机（0..1），用于「乱中有序」的抖动 */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) / 2147483648
}

interface VineNode {
  id: string
  title: string
  date: string
  rating: number
  images: number
  x: number
  y: number
}
interface VineColumn {
  id: string
  label: string
  sub: string
  nodes: VineNode[]
}

function weekday(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return WEEKDAY[new Date(y, m - 1, d).getDay()]
}

/** 笔记的学科见 utils/noteSubject（与笔记列表的「内容」视图保持一致） */
function subjectOf(noteId: string, fallback: string): string {
  return subjectOfNote(noteId, fallback, linksStore.links, tasksStore.tasks)
}

function toNode(n: { id: string; title: string; date: string; rating: number; images: string[] }): VineNode {
  return { id: n.id, title: n.title, date: n.date, rating: n.rating, images: n.images.length, x: CX, y: TOP }
}

/** 给一列节点分配「葡萄」位置：从藤的顶端往下挂，节点之间固定间距 */
const STEP = 84
function placeNodes(nodes: VineNode[]): VineNode[] {
  const n = nodes.length
  const avail = BOTTOM - TOP
  const step = n <= 1 ? 0 : Math.min(STEP, avail / (n - 1))
  nodes.forEach((node, i) => {
    const y = TOP + i * step
    const side = i % 2 === 0 ? -1 : 1
    const off = side * (16 + hash(node.id) * 18)
    node.y = y
    node.x = Math.max(80, Math.min(COL_W - 80, CX + off))
  })
  return nodes
}

const columns = computed<VineColumn[]>(() => {
  const notes = notesStore.notes
  if (mode.value === 'time') {
    const byDay = new Map<string, VineNode[]>()
    for (const n of notes) {
      const day = n.date || '未标日期'
      if (!byDay.has(day)) byDay.set(day, [])
      byDay.get(day)!.push(toNode(n))
    }
    const days = [...byDay.keys()].sort()
    return days.map((day) => {
      const nodes = placeNodes(byDay.get(day)!.sort((a, b) => a.title.localeCompare(b.title, 'zh')))
      return {
        id: day,
        label: day === '未标日期' ? day : day.slice(5),
        sub: day === '未标日期' ? '' : `周${weekday(day)}`,
        nodes
      }
    })
  }
  // 学科主线
  const bySubject = new Map<string, VineNode[]>()
  for (const n of notes) {
    const s = subjectOf(n.id, n.category)
    if (!bySubject.has(s)) bySubject.set(s, [])
    bySubject.get(s)!.push(toNode(n))
  }
  const subjects = [...bySubject.keys()].sort((a, b) => a.localeCompare(b, 'zh'))
  return subjects.map((s) => {
    const nodes = placeNodes(
      bySubject.get(s)!.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title, 'zh')))
    )
    return { id: s, label: s, sub: `${nodes.length} 篇`, nodes }
  })
})

const trackX = computed(() => {
  if (containerW.value === 0) return 0
  return containerW.value / 2 - COL_W / 2 - activeCol.value * COL_W
})

const colCount = computed(() => columns.value.length)
const active = computed(() => columns.value[activeCol.value]?.nodes[activeNode.value] ?? null)
const activeNote = computed(() => {
  const a = active.value
  return a ? notesStore.byId(a.id) ?? null : null
})
/** 预览里也渲染 Markdown */
const renderedContent = computed(() =>
  activeNote.value ? renderMarkdown(activeNote.value.content) : ''
)

function clampCol(i: number): void {
  activeCol.value = Math.max(0, Math.min(colCount.value - 1, i))
  activeNode.value = 0
}

function clampNode(i: number): void {
  const n = columns.value[activeCol.value]?.nodes.length ?? 0
  activeNode.value = Math.max(0, Math.min(n - 1, i))
}

function switchMode(m: Mode): void {
  if (m === mode.value) return
  mode.value = m
  activeCol.value = 0
  activeNode.value = 0
}

function onWheel(e: WheelEvent): void {
  e.preventDefault()
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    clampCol(activeCol.value + (e.deltaX > 0 ? 1 : -1))
  } else {
    clampNode(activeNode.value + (e.deltaY > 0 ? 1 : -1))
  }
}

function onKey(e: KeyboardEvent): void {
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    clampCol(activeCol.value - 1)
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    clampCol(activeCol.value + 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    clampNode(activeNode.value - 1)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    clampNode(activeNode.value + 1)
  } else if (e.key === 'Enter' && active.value) {
    emit('open', active.value.id)
  }
}

function focusNode(col: number, node: number): void {
  activeCol.value = col
  activeNode.value = node
}

function openNode(n: VineNode): void {
  emit('open', n.id)
}
</script>

<template>
  <div class="vine">
    <div class="vine-bar">
      <div class="vine-modes">
        <button :class="{ on: mode === 'time' }" @click="switchMode('time')">时间主线</button>
        <button :class="{ on: mode === 'subject' }" @click="switchMode('subject')">学科主线</button>
      </div>
      <div class="vine-now">
        <template v-if="active">
          <span class="now-label">{{ columns[activeCol].label }}</span>
          <span class="now-title">{{ active.title }}</span>
          <span class="now-pos">{{ activeNode + 1 }}/{{ columns[activeCol].nodes.length }}</span>
        </template>
        <span v-else class="now-empty">还没有笔记</span>
      </div>
      <div class="vine-hint">滚轮/↑↓ 切支线 · ←→ 切主线 · 单击选中（右侧看正文）· 双击进入</div>
    </div>

    <div class="vine-body">
    <div
      ref="containerRef"
      class="vine-stage"
      :style="{ height: H + 'px' }"
      @wheel.prevent="onWheel"
    >
      <div
        v-if="columns.length"
        class="track"
        :style="{ width: colCount * COL_W + 'px', transform: `translateX(${trackX}px)` }"
      >
        <div
          v-for="(col, ci) in columns"
          :key="col.id"
          class="column"
          :class="{ on: ci === activeCol }"
          :style="{ left: ci * COL_W + 'px', width: COL_W + 'px' }"
        >
          <div class="root">
            <span class="root-dot"></span>
            <span class="root-label">{{ col.label }}</span>
            <span v-if="col.sub" class="root-sub">{{ col.sub }}</span>
          </div>

          <!-- 藤蔓 + 果柄 -->
          <svg class="vine-svg" :viewBox="`0 0 ${COL_W} ${H}`" preserveAspectRatio="none">
            <path
              class="vine-stem"
              :d="`M ${CX} ${TOP} C ${CX - 14} ${(TOP + BOTTOM) / 2 - 20}, ${CX + 14} ${(TOP + BOTTOM) / 2 + 20}, ${CX} ${BOTTOM}`"
            />
            <line
              v-for="node in col.nodes"
              :key="node.id"
              class="stalk"
              :x1="CX"
              :y1="node.y - 26"
              :x2="node.x"
              :y2="node.y - 20"
            />
          </svg>

          <!-- 葡萄（笔记节点） -->
          <button
            v-for="(node, ni) in col.nodes"
            :key="node.id"
            class="grape"
            :class="{ active: ci === activeCol && ni === activeNode }"
            :style="{
              left: node.x - 78 + 'px',
              top: node.y - NODE_H / 2 + 'px',
              '--tilt': ((hash(node.id) - 0.5) * 4).toFixed(1) + 'deg'
            }"
            @click="focusNode(ci, ni)"
            @dblclick="openNode(node)"
          >
            <span class="grape-title">{{ node.title }}</span>
            <span class="grape-meta">
              <span>{{ node.date ? node.date.slice(5) : '' }}</span>
              <span class="grape-stars">
                <AppIcon v-for="i in node.rating" :key="i" name="star" :size="9" />
              </span>
              <AppIcon v-if="node.images" name="image" :size="10" />
            </span>
          </button>
        </div>
      </div>

      <div v-if="columns.length === 0" class="vine-empty">
        <AppIcon name="notes" :size="34" />
        <p>还没有笔记，先去「列表」写一篇吧。<br />写下的笔记会像葡萄一样挂在时间或学科的藤上。</p>
      </div>
    </div>

    <aside v-if="activeNote" class="vine-preview">
      <div class="pv-head">
        <span class="pv-date">{{ activeNote.date || '' }}</span>
        <button class="pv-open" @click="active && openNode(active)">打开编辑</button>
      </div>
      <h4 class="pv-title">{{ activeNote.title }}</h4>
      <div class="pv-stars">
        <AppIcon v-for="i in activeNote.rating" :key="i" name="star" :size="12" />
      </div>
      <div v-if="activeNote.content" class="pv-body md" v-html="renderedContent"></div>
      <pre v-else class="pv-body">（这篇还没有正文）</pre>
    </aside>
    </div>
  </div>
</template>

<style scoped>
.vine {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.vine-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.vine-modes {
  display: flex;
  gap: 5px;
}
.vine-modes button {
  font-family: var(--font-display);
  font-size: 0.92rem;
  letter-spacing: 0.02em;
  padding: 0.32rem 0.85rem;
  border: 2px solid var(--border);
  border-radius: 13px;
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  box-shadow: 0 3px 0 var(--surface-2);
  transition:
    transform 0.14s ease,
    box-shadow 0.14s ease,
    border-color 0.14s ease,
    color 0.14s ease,
    background-color 0.14s ease;
}
.vine-modes button:hover {
  transform: translateY(-1px);
  border-color: var(--accent);
  color: var(--accent);
}
.vine-modes button.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  box-shadow: 0 3px 0 var(--accent-soft);
}
.vine-now {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.85rem;
}
.now-label {
  font-weight: 700;
  color: var(--accent);
}
.now-title {
  color: var(--text);
}
.now-pos {
  font-family: var(--font-num);
  color: var(--text-3);
  font-size: 0.75rem;
}
.vine-hint {
  margin-left: auto;
  font-size: 0.72rem;
  color: var(--text-3);
}
.vine-body {
  display: flex;
  gap: 0.7rem;
  align-items: stretch;
}
.vine-stage {
  flex: 1;
  min-width: 0;
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  background:
    radial-gradient(1200px 400px at 50% -10%, var(--accent-soft), transparent 70%),
    var(--surface);
  border: 1px solid var(--border);
}
.vine-preview {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 0.9rem;
}
.pv-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pv-date {
  font-family: var(--font-num);
  font-size: 0.78rem;
  color: var(--text-3);
}
.pv-open {
  border: 1px solid var(--accent);
  background: var(--surface);
  color: var(--accent);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 0.76rem;
  cursor: pointer;
}
.pv-open:hover {
  background: var(--accent);
  color: #fff;
}
.pv-title {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.3;
}
.pv-stars {
  display: inline-flex;
  gap: 1px;
  color: var(--accent);
}
.pv-body {
  flex: 1;
  min-height: 0;
  margin: 0.4rem 0 0;
  padding: 0.5rem 0;
  font-family: inherit;
  font-size: 0.85rem;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-y: auto;
  color: var(--text-2);
}
.pv-body.md {
  white-space: normal;
}
.pv-body.md :deep(h1),
.pv-body.md :deep(h2),
.pv-body.md :deep(h3),
.pv-body.md :deep(h4) {
  margin: 0.6rem 0 0.3rem;
  font-size: 0.98rem;
  color: var(--text);
}
.pv-body.md :deep(p) {
  margin: 0.35rem 0;
}
.pv-body.md :deep(ul),
.pv-body.md :deep(ol) {
  margin: 0.35rem 0;
  padding-left: 1.2rem;
}
.pv-body.md :deep(code) {
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 0.85em;
  background: var(--surface-2);
  border-radius: 5px;
  padding: 1px 4px;
}
.pv-body.md :deep(blockquote) {
  margin: 0.4rem 0;
  padding: 0.25rem 0.7rem;
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
  border-radius: 0 8px 8px 0;
}
.pv-body.md :deep(img) {
  max-width: 100%;
  border-radius: 8px;
}
.pv-body.md :deep(strong) {
  color: var(--text);
}
.track {
  position: relative;
  height: 100%;
  transition: transform 0.45s cubic-bezier(0.22, 0.9, 0.3, 1);
}
.column {
  position: absolute;
  top: 0;
  height: 100%;
}
.column.on .vine-stem {
  stroke: var(--accent);
  stroke-width: 3.5;
  opacity: 0.9;
}
.column.on .root-label {
  color: var(--accent);
}
.root {
  position: absolute;
  top: 12px;
  left: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  pointer-events: none;
}
.root-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.7;
}
.root-label {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text);
  transition: color 0.2s;
}
.root-sub {
  font-size: 0.7rem;
  color: var(--text-3);
}
.vine-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.vine-stem {
  stroke: rgba(120, 160, 130, 0.45);
  stroke-width: 2.5;
  fill: none;
  transition: stroke 0.25s, stroke-width 0.25s;
}
.stalk {
  stroke: rgba(120, 160, 130, 0.4);
  stroke-width: 1.5;
}
.grape {
  position: absolute;
  width: 156px;
  min-height: 46px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 15px 15px 18px 18px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transform: rotate(var(--tilt, 0deg));
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
  opacity: 0.78;
}
.grape:hover {
  transform: rotate(0deg) scale(1.04);
  opacity: 1;
}
.grape.active {
  border-color: var(--accent);
  box-shadow: 0 6px 18px rgba(207, 74, 60, 0.22);
  transform: rotate(0deg) scale(1.09);
  opacity: 1;
  z-index: 2;
}
.grape-title {
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grape-meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--font-num);
  font-size: 0.68rem;
  color: var(--text-3);
}
.grape-stars {
  display: inline-flex;
  gap: 1px;
  color: var(--accent);
}
.vine-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  color: var(--text-3);
  text-align: center;
  font-size: 0.88rem;
}
</style>
