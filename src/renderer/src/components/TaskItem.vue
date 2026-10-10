<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import type { Task } from '../../../shared/types'
import { formatDate } from '../utils/helpers'
import { REPEAT_LABELS } from '../utils/schedule'
import { useTasksStore } from '../stores/tasks'
import { draggingTaskId, dropTargetId, clearDrag, startAutoScroll } from '../utils/taskDrag'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ task: Task; flash?: boolean }>()
const emit = defineEmits<{
  toggle: []
  remove: []
  edit: []
  note: []
  locate: []
  /** 子任务要打开编辑弹窗时，把子任务本身抛给视图 */
  editChild: [task: Task]
}>()

const store = useTasksStore()
/** 附属支线：只有顶层任务会挂子任务，避免递归套娃 */
const children = computed(() =>
  props.task.parentId ? [] : store.tasks.filter((t) => t.parentId === props.task.id)
)
const addingChild = ref(false)
const childTitle = ref('')
const childInput = ref<HTMLInputElement | null>(null)

async function startAddChild(): Promise<void> {
  addingChild.value = !addingChild.value
  if (!addingChild.value) return
  await nextTick()
  childInput.value?.focus()
}

async function addChild(): Promise<void> {
  const t = childTitle.value.trim()
  if (!t) {
    addingChild.value = false
    return
  }
  await store.addTask({
    title: t,
    type: 'side',
    importance: Math.max(1, props.task.importance - 1),
    due: props.task.due,
    seasonId: props.task.seasonId,
    parentId: props.task.id
  })
  childTitle.value = ''
  addingChild.value = false
}

async function toggleChild(c: Task): Promise<void> {
  await store.setStatus(c.id, c.status === 'done' ? 'todo' : 'done')
}

// ---------- 拖拽：把一条任务拖到另一条上，它就变成那条的支线 ----------
const dragging = computed(() => draggingTaskId.value === props.task.id)
const dropHere = computed(() => dropTargetId.value === props.task.id)

/** 不能拖到自己身上，也不能拖到自己的后代上（防止成环） */
function isDescendant(candidateId: string, ancestorId: string): boolean {
  let cur = store.tasks.find((t) => t.id === candidateId)
  let guard = 0
  while (cur?.parentId && guard < 20) {
    if (cur.parentId === ancestorId) return true
    cur = store.tasks.find((t) => t.id === cur!.parentId)
    guard++
  }
  return false
}

function onDragStart(e: DragEvent): void {
  draggingTaskId.value = props.task.id
  startAutoScroll()
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', props.task.id)
  }
}

function onDragOver(e: DragEvent): void {
  const from = draggingTaskId.value
  if (!from || from === props.task.id) return
  if (isDescendant(props.task.id, from)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dropTargetId.value = props.task.id
}

function onDragLeave(): void {
  if (dropTargetId.value === props.task.id) dropTargetId.value = null
}

async function onDrop(e: DragEvent): Promise<void> {
  e.preventDefault()
  const from = draggingTaskId.value
  clearDrag()
  if (!from || from === props.task.id) return
  if (isDescendant(props.task.id, from)) return
  await store.updateTask(from, { parentId: props.task.id, type: 'side' })
}

/** 把这条支线从主线上摘下来 */
async function detach(): Promise<void> {
  await store.updateTask(props.task.id, { parentId: null })
}

const done = computed(() => props.task.status === 'done')
const isSchedule = computed(() => props.task.kind === 'schedule')
/** 详情默认收成一行，长内容不撑高列表 */
const descOpen = ref(false)

/** 指针角度：越重要越指向上方 */
const needleAngle = computed(() => (3 - props.task.importance) * 34)

const GEM_COLOR: Record<number, string> = {
  5: 'var(--imp5)',
  4: 'var(--imp4)',
  3: '#d9a52b',
  2: '#55a89f',
  1: 'var(--text-3)'
}

const dialColor = computed(() => GEM_COLOR[props.task.importance] ?? 'var(--text-3)')
</script>

<template>
  <div
    class="quest"
    :class="[`imp-${task.importance}`, { done, schedule: isSchedule, flash, dragging, 'drop-here': dropHere }]"
    draggable="true"
    @dragstart="onDragStart"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
    @dragend="clearDrag"
  >
    <div class="inner">
      <button class="check" @click="emit('toggle')">{{ done ? '✓' : '' }}</button>

      <svg class="dial" viewBox="0 0 40 40" :style="{ '--dial': dialColor }">
        <circle cx="20" cy="20" r="16.5" class="ring" />
        <g :transform="`rotate(${needleAngle} 20 20)`">
          <path d="M20 6.5 L23.4 20 L20 33.5 L16.6 20 Z" class="needle" />
        </g>
        <circle cx="20" cy="20" r="2.4" class="hub" />
      </svg>

      <div class="body" title="点击编辑" @click="emit('edit')">
        <div class="title">{{ task.title }}</div>
        <div class="meta">
          <span v-if="isSchedule && task.startTime" class="pill time">
            {{ task.startTime }}<template v-if="task.endTime">–{{ task.endTime }}</template>
          </span>
          <span v-else-if="task.due" class="pill">{{ formatDate(task.due) }}</span>
          <span v-if="task.location" class="loc">{{ task.location }}</span>
          <span v-if="task.repeat && task.repeat !== 'none'" class="pill weekly">
            {{ REPEAT_LABELS[task.repeat] }}
          </span>
          <span v-if="task.repeatUntil" class="pill range">至 {{ task.repeatUntil.slice(5) }}</span>
        </div>
        <div v-if="task.description" class="desc-row">
          <span class="desc" :class="{ open: descOpen }" :title="task.description">{{ task.description }}</span>
          <button
            v-if="task.description.length > 40"
            class="desc-toggle"
            @click.stop="descOpen = !descOpen"
          >
            {{ descOpen ? '收起' : '展开' }}
          </button>
        </div>
      </div>

      <button class="add-child" title="在这条主线下挂一条支线任务" @click.stop="startAddChild">
        <AppIcon name="plus" :size="14" />
      </button>

      <button class="locate" title="在日历里定位到这件事所在的那一周" @click.stop="emit('locate')">
        <AppIcon name="calendar" :size="15" />
      </button>

      <button class="take-note" title="为这件事写一篇笔记" @click.stop="emit('note')">
        <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
          <path
            d="M5 3.2h7.2L15 6v10.8H5z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linejoin="round"
          />
          <path d="M12 3.2V6h2.8M7.4 9.6h5.2M7.4 12.8h5.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" />
        </svg>
      </button>

      <button class="remove" @click="emit('remove')" title="删除">✕</button>
    </div>

    <!-- 附属的支线任务 -->
    <div v-if="children.length || addingChild" class="kids">
      <div v-for="c in children" :key="c.id" class="kid" :class="{ done: c.status === 'done' }">
        <button class="kid-check" @click.stop="toggleChild(c)">{{ c.status === 'done' ? '✓' : '' }}</button>
        <span class="kid-title" title="点击编辑" @click.stop="emit('editChild', c)">{{ c.title }}</span>
        <span v-if="c.startTime" class="kid-time">{{ c.startTime }}<template v-if="c.endTime">–{{ c.endTime }}</template></span>
        <span v-else-if="c.due" class="kid-time">{{ c.due.slice(5) }}</span>
        <button class="kid-x" title="从主线上摘下来" @click.stop="detach">⤴</button>
        <button class="kid-x" title="删除这条支线" @click.stop="store.removeTask(c.id)">✕</button>
      </div>
      <div v-if="addingChild" class="kid-add">
        <input
          ref="childInput"
          v-model="childTitle"
          class="kid-input"
          placeholder="支线任务名称，回车添加…"
          @keyup.enter="addChild"
          @keyup.esc="addingChild = false"
          @blur="addChild"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 罗盘风格的“任务旗”：右侧带尖角，非方块 */
.quest {
  margin-bottom: 0.5rem;
  filter: drop-shadow(0 2px 6px rgba(30, 40, 60, 0.1));
  transition: transform 0.16s ease;
}
.quest:hover {
  transform: translateX(4px);
}
/* 拖拽中的那条变淡；接收的那条高亮成"挂到这里" */
.quest.dragging {
  opacity: 0.45;
}
.quest.drop-here .inner {
  background-color: var(--accent-soft);
  box-shadow: inset 0 0 0 2px var(--accent);
}
.quest.drop-here::after {
  content: '挂成支线';
  position: absolute;
  right: 12px;
  top: -9px;
  font-size: 0.68rem;
  color: #fff;
  background: var(--accent);
  border-radius: 6px;
  padding: 0 6px;
  z-index: 4;
}
/* 从任务定位过来的那条：闪几下并放大，几秒后自己停 */
.quest.flash {
  animation: questFlash 1.2s ease-in-out 3;
  z-index: 2;
  position: relative;
}
@keyframes questFlash {
  0%,
  100% {
    transform: none;
    filter: none;
  }
  35% {
    transform: translateX(6px) scale(1.02);
    filter: drop-shadow(0 0 10px rgba(207, 74, 60, 0.45));
  }
}
.quest.flash .inner {
  animation: questFlashBg 1.2s ease-in-out 3;
}
@keyframes questFlashBg {
  0%,
  100% {
    background-color: var(--surface);
  }
  35% {
    background-color: var(--accent-soft);
  }
}
.inner {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.6rem 1.5rem 0.6rem 0.9rem;
  background: var(--surface);
  clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 7px 50%);
}
.quest.done {
  opacity: 0.45;
}
.quest.done .title {
  text-decoration: line-through;
}
.quest.imp-5 .inner {
  background: linear-gradient(90deg, rgba(217, 80, 80, 0.12), var(--surface));
}
.quest.imp-4 .inner {
  background: linear-gradient(90deg, rgba(224, 123, 57, 0.1), var(--surface));
}
.quest.imp-3 .inner {
  background: linear-gradient(90deg, rgba(217, 165, 43, 0.1), var(--surface));
}
.quest.imp-2 .inner {
  background: linear-gradient(90deg, rgba(85, 168, 159, 0.1), var(--surface));
}
.quest.imp-1 {
  opacity: 0.72;
}

.check {
  width: 23px;
  height: 23px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: none;
  color: #fff;
  font-size: 0.8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
}
.quest.done .check {
  background: var(--accent);
  border-color: var(--accent);
}

.dial {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
}
.ring {
  fill: none;
  stroke: var(--border);
  stroke-width: 1.6;
}
.needle {
  fill: var(--dial);
}
.hub {
  fill: var(--surface);
  stroke: var(--dial);
  stroke-width: 1.6;
}

.body {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}
.title {
  font-weight: 550;
}
.quest.imp-5 .title {
  font-weight: 700;
  font-size: 1.04rem;
}
.quest.imp-2 .title,
.quest.imp-1 .title {
  font-weight: 400;
  color: var(--text-2);
}
.meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.15rem;
  font-size: 0.78rem;
  color: var(--text-2);
  flex-wrap: wrap;
}
.pill {
  background: var(--surface-2);
  border-radius: 6px;
  padding: 1px 6px;
}
.pill.time {
  background: rgba(91, 141, 239, 0.16);
  color: #3f6fd0;
  font-weight: 600;
}
.pill.weekly {
  background: rgba(85, 168, 159, 0.16);
  color: #3d827a;
}
.pill.range {
  background: var(--surface-2);
  color: var(--text-2);
}
.loc {
  color: var(--text-3);
}
.desc-row {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin-top: 0.2rem;
}
/* 详情默认只占一行，不撑高列表 */
.desc {
  flex: 1;
  min-width: 0;
  font-size: 0.76rem;
  color: var(--text-3);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
.desc.open {
  display: block;
  -webkit-line-clamp: unset;
  white-space: pre-wrap;
}
.desc-toggle {
  flex-shrink: 0;
  border: none;
  background: none;
  color: var(--accent);
  font-size: 0.72rem;
  cursor: pointer;
  padding: 0 2px;
}
.desc-toggle:hover {
  text-decoration: underline;
}
.take-note,
.locate,
.add-child {
  background: none;
  border: none;
  color: var(--text-3);
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: 6px;
  opacity: 0.55;
  transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}
.quest:hover .take-note,
.quest:hover .locate,
.quest:hover .add-child {
  opacity: 1;
}
.take-note:hover,
.locate:hover,
.add-child:hover {
  color: var(--accent);
  background: var(--accent-soft);
}
/* 附属支线：缩进 + 左侧连接线，一眼看出挂在哪条主线下 */
.kids {
  margin: -0.2rem 0 0.5rem 2.1rem;
  padding-left: 0.75rem;
  border-left: 2px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.kid {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  color: var(--text-2);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.2rem 0.5rem;
}
.kid.done .kid-title {
  text-decoration: line-through;
  opacity: 0.6;
}
.kid-check {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: none;
  color: #fff;
  font-size: 0.6rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
}
.kid.done .kid-check {
  background: var(--accent);
  border-color: var(--accent);
}
.kid-title {
  flex: 1;
  min-width: 0;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kid-title:hover {
  color: var(--accent);
}
.kid-time {
  font-family: var(--font-num);
  font-size: 0.72rem;
  color: var(--text-3);
}
.kid-x {
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
  font-size: 0.72rem;
}
.kid-x:hover {
  color: var(--danger);
}
.kid-add {
  display: flex;
}
.kid-input {
  flex: 1;
  padding: 0.25rem 0.5rem;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.82rem;
}
.remove {
  background: none;
  border: none;
  color: var(--text-3);
  cursor: pointer;
  font-size: 0.85rem;
}
.remove:hover {
  color: var(--danger);
}
</style>
