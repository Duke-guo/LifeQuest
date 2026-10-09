<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Task } from '../../../shared/types'
import { formatDate } from '../utils/helpers'
import { REPEAT_LABELS } from '../utils/schedule'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{ toggle: []; remove: []; edit: []; note: []; locate: [] }>()

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
  <div class="quest" :class="[`imp-${task.importance}`, { done, schedule: isSchedule }]">
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
  background: linear-gradient(90deg, rgba(217, 80, 80, 0.1), var(--surface));
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
.locate {
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
.quest:hover .locate {
  opacity: 1;
}
.take-note:hover,
.locate:hover {
  color: var(--accent);
  background: var(--accent-soft);
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
