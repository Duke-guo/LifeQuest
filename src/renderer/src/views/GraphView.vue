<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useNotesStore } from '../stores/notes'
import { useTasksStore } from '../stores/tasks'
import { useTagsStore } from '../stores/tags'
import { useLinksStore } from '../stores/links'
import AppIcon from '../components/AppIcon.vue'

const notesStore = useNotesStore()
const tasksStore = useTasksStore()
const tagsStore = useTagsStore()
const linksStore = useLinksStore()

const emit = defineEmits<{ openNote: [id: string] }>()

interface GNode {
  id: string
  kind: 'note' | 'task' | 'tag'
  label: string
  x: number
  y: number
  vx: number
  vy: number
  color: string
}

interface GEdge {
  a: string
  b: string
  kind: 'link' | 'tag'
}

const W = 980
const H = 560

const nodes = ref<GNode[]>([])
const edges = ref<GEdge[]>([])
const selected = ref<string | null>(null)
const loading = ref(true)

onMounted(async () => {
  await build()
  loading.value = false
})

const KIND_COLOR: Record<string, string> = {
  note: '#c9564a',
  task: '#5b8def',
  tag: '#55a89f'
}

async function build(): Promise<void> {
  await notesStore.list()
  if (!tasksStore.loaded) await tasksStore.load()
  await tagsStore.load()
  await linksStore.load()

  const ns: GNode[] = []
  const es: GEdge[] = []

  for (const n of notesStore.notes) {
    ns.push({
      id: `note:${n.id}`,
      kind: 'note',
      label: n.title,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      color: n.category ? tagsStore.colorOf(n.category) : KIND_COLOR.note
    })
    for (const t of n.tags) {
      const tagId = `tag:${t}`
      if (!ns.some((x) => x.id === tagId)) {
        ns.push({ id: tagId, kind: 'tag', label: t, x: 0, y: 0, vx: 0, vy: 0, color: tagsStore.colorOf(t) })
      }
      es.push({ a: `note:${n.id}`, b: tagId, kind: 'tag' })
    }
  }

  for (const t of tasksStore.tasks) {
    const hasLink = linksStore.links.some(
      (l) => (l.from.kind === 'task' && l.from.id === t.id) || (l.to.kind === 'task' && l.to.id === t.id)
    )
    if (!hasLink) continue
    ns.push({ id: `task:${t.id}`, kind: 'task', label: t.title, x: 0, y: 0, vx: 0, vy: 0, color: KIND_COLOR.task })
  }

  for (const l of linksStore.links) {
    const a = `${l.from.kind}:${l.from.id}`
    const b = `${l.to.kind}:${l.to.id}`
    if (ns.some((n) => n.id === a) && ns.some((n) => n.id === b)) {
      es.push({ a, b, kind: 'link' })
    }
  }

  // 过滤掉孤立标签
  const usedTags = new Set<string>()
  for (const e of es) {
    usedTags.add(e.a)
    usedTags.add(e.b)
  }
  const filtered = ns.filter((n) => n.kind !== 'tag' || usedTags.has(n.id))

  layout(filtered, es)
  nodes.value = filtered
  edges.value = es
}

function layout(list: GNode[], linkList: GEdge[]): void {
  const n = list.length
  if (n === 0) return
  list.forEach((node, i) => {
    const ang = (i / n) * Math.PI * 2
    const r = Math.min(W, H) * 0.33
    node.x = W / 2 + Math.cos(ang) * r
    node.y = H / 2 + Math.sin(ang) * r
  })

  const byId = new Map(list.map((x) => [x.id, x]))

  for (let iter = 0; iter < 240; iter++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = list[i]
        const b = list[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d2 = dx * dx + dy * dy || 0.01
        const d = Math.sqrt(d2)
        const f = 5600 / d2
        const fx = (dx / d) * f
        const fy = (dy / d) * f
        a.vx -= fx
        a.vy -= fy
        b.vx += fx
        b.vy += fy
      }
    }
    for (const e of linkList) {
      const a = byId.get(e.a)
      const b = byId.get(e.b)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01
      const f = (d - 130) * 0.014
      const fx = (dx / d) * f
      const fy = (dy / d) * f
      a.vx += fx
      a.vy += fy
      b.vx -= fx
      b.vy -= fy
    }
    for (const node of list) {
      node.vx += (W / 2 - node.x) * 0.0022
      node.vy += (H / 2 - node.y) * 0.0022
      node.x += Math.max(-9, Math.min(9, node.vx))
      node.y += Math.max(-9, Math.min(9, node.vy))
      node.vx *= 0.8
      node.vy *= 0.8
      node.x = Math.max(46, Math.min(W - 46, node.x))
      node.y = Math.max(30, Math.min(H - 30, node.y))
    }
  }
}

const nodeById = computed(() => new Map(nodes.value.map((n) => [n.id, n])))

function isDimmed(e: GEdge): boolean {
  if (!selected.value) return false
  return e.a !== selected.value && e.b !== selected.value
}

function isDimmedNode(node: GNode): boolean {
  if (!selected.value) return false
  if (node.id === selected.value) return false
  return !edges.value.some(
    (e) =>
      (e.a === selected.value && e.b === node.id) || (e.b === selected.value && e.a === node.id)
  )
}

function degree(id: string): number {
  return edges.value.filter((e) => e.a === id || e.b === id).length
}

function refresh(): void {
  loading.value = true
  build().then(() => (loading.value = false))
}

/** 选中的节点（用来弹「进入笔记」等操作） */
const selNode = computed(() => nodes.value.find((n) => n.id === selected.value) ?? null)

const KIND_NAME: Record<string, string> = { note: '笔记', task: '任务', tag: '标签' }

/** 选中的是笔记 → 进入这篇笔记 */
function openSelNote(): void {
  const n = selNode.value
  if (!n || n.kind !== 'note') return
  emit('openNote', n.id.slice('note:'.length))
}

/** 与选中节点直接相连的其它节点 */
const selNeighbors = computed(() => {
  const id = selected.value
  if (!id) return []
  return edges.value
    .filter((e) => e.a === id || e.b === id)
    .map((e) => nodeById.value.get(e.a === id ? e.b : e.a))
    .filter((n): n is GNode => !!n)
    .slice(0, 8)
})
</script>

<template>
  <div class="graph-view">
    <header class="view-head">
      <div>
        <h2>知识地图</h2>
        <p class="sub">笔记 · 任务 · 标签 之间的关联关系（点节点高亮）</p>
      </div>
      <button class="refresh" @click="refresh">重新布局</button>
    </header>

    <div class="legend">
      <span class="lg"><i style="background: #c9564a"></i>笔记</span>
      <span class="lg"><i style="background: #5b8def"></i>任务</span>
      <span class="lg"><i style="background: #55a89f"></i>标签</span>
      <span class="stat">{{ nodes.length }} 个节点 · {{ edges.length }} 条关联</span>
    </div>

    <div v-if="loading" class="empty">正在计算布局…</div>
    <div v-else-if="nodes.length === 0" class="empty">
      还没有可展示的关联。去「笔记」给笔记加标签、或把笔记「关联」到任务试试。
    </div>

    <div v-else class="canvas-wrap">
      <svg class="canvas" :viewBox="`0 0 ${W} ${H}`" @click="selected = null">
        <line
          v-for="(e, i) in edges"
          :key="i"
          :x1="nodeById.get(e.a)?.x ?? 0"
          :y1="nodeById.get(e.a)?.y ?? 0"
          :x2="nodeById.get(e.b)?.x ?? 0"
          :y2="nodeById.get(e.b)?.y ?? 0"
          :class="['edge', e.kind, { dim: isDimmed(e) }]"
        />
        <g
          v-for="node in nodes"
          :key="node.id"
          :class="['node', { dim: isDimmedNode(node), sel: selected === node.id }]"
          :transform="`translate(${node.x} ${node.y})`"
          @click.stop="selected = selected === node.id ? null : node.id"
          @dblclick.stop="node.kind === 'note' && emit('openNote', node.id.slice(5))"
        >
          <circle :r="node.kind === 'tag' ? 9 : 13" :fill="node.color" />
          <text :y="node.kind === 'tag' ? -16 : -20" text-anchor="middle">{{ node.label }}</text>
          <text v-if="degree(node.id) > 1" :y="node.kind === 'tag' ? 20 : 25" text-anchor="middle" class="deg">
            {{ degree(node.id) }}
          </text>
        </g>
      </svg>

      <!-- 点中节点后的操作面板 -->
      <transition name="fade">
        <div v-if="selNode" class="node-panel">
          <button class="np-close" title="关闭" @click="selected = null">✕</button>
          <div class="np-head">
            <span class="np-kind" :class="selNode.kind">{{ KIND_NAME[selNode.kind] }}</span>
            <span class="np-label">{{ selNode.label }}</span>
          </div>
          <div class="np-deg">{{ degree(selNode.id) }} 条关联</div>

          <button v-if="selNode.kind === 'note'" class="np-btn" @click="openSelNote">
            <AppIcon name="notes" :size="15" /> 进入这篇笔记
          </button>
          <p v-else class="np-hint">标签用来把笔记串在一起，点下面的节点可以跳过去。</p>

          <div v-if="selNeighbors.length" class="np-nb">
            <span class="np-nb-title">相连</span>
            <button v-for="n in selNeighbors" :key="n.id" class="np-chip" @click="selected = n.id">
              {{ n.label }}
            </button>
          </div>
        </div>
      </transition>
    </div>

    <p class="tip">
      <AppIcon name="guide" :size="14" /> 关联越多的节点会自动聚得越近；点节点看它的关系网，笔记节点可直接「进入这篇笔记」（或双击）。
    </p>
  </div>
</template>

<style scoped>
.refresh {
  padding: 0.5rem 1rem;
  border: 1px solid var(--accent);
  background: var(--surface);
  color: var(--accent);
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
}
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
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
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
  cursor: default;
  display: block;
}
.canvas-wrap {
  position: relative;
}
/* 点中节点后的操作面板 */
.node-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 232px;
  padding: 0.75rem 0.85rem 0.85rem;
  background: var(--surface);
  border: 2px solid var(--accent);
  border-radius: 14px;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.np-close {
  position: absolute;
  top: 6px;
  right: 8px;
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  font-size: 0.8rem;
}
.np-close:hover {
  color: var(--accent);
}
.np-head {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding-right: 1rem;
}
.np-kind {
  font-size: 0.68rem;
  color: #fff;
  background: var(--text-3);
  border-radius: 6px;
  padding: 1px 6px;
  align-self: flex-start;
}
.np-kind.note {
  background: #c9564a;
}
.np-kind.task {
  background: #5b8def;
}
.np-kind.tag {
  background: #55a89f;
}
.np-label {
  font-family: var(--font-display);
  font-size: 1rem;
  line-height: 1.3;
  word-break: break-word;
}
.np-deg {
  font-size: 0.74rem;
  color: var(--text-3);
}
.np-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  font-family: var(--font-display);
  font-size: 0.9rem;
  padding: 0.34rem 0.8rem;
  border: 2px solid var(--accent);
  border-radius: 12px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 3px 0 var(--accent-soft);
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}
.np-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 5px 0 var(--accent-soft);
}
.np-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-3);
  line-height: 1.5;
}
.np-nb {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.np-nb-title {
  font-size: 0.7rem;
  color: var(--text-3);
}
.np-chip {
  font-size: 0.72rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text-2);
  padding: 1px 8px;
  cursor: pointer;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.np-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.edge {
  stroke: var(--border);
  stroke-width: 1.4;
  transition: opacity 0.2s ease;
}
.edge.link {
  stroke: var(--accent);
  stroke-width: 2;
  stroke-dasharray: 5 4;
}
.edge.dim {
  opacity: 0.12;
}
.node {
  cursor: pointer;
  transition: opacity 0.2s ease;
}
.node.dim {
  opacity: 0.2;
}
.node circle {
  transition: r 0.15s ease, filter 0.15s ease;
}
.node.sel circle {
  filter: drop-shadow(0 0 8px currentColor);
}
.node text {
  font-size: 12px;
  fill: var(--text);
  font-family: var(--font-body);
  pointer-events: none;
}
.node .deg {
  font-size: 10px;
  fill: var(--text-3);
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
