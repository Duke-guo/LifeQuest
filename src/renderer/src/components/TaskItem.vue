<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '../../../shared/types'
import { formatDate } from '../utils/helpers'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{ toggle: []; remove: [] }>()

const done = computed(() => props.task.status === 'done')
</script>

<template>
  <div class="task-item" :class="[`imp-${task.importance}`, { done }]">
    <button class="check" @click="emit('toggle')">{{ done ? '✓' : '' }}</button>
    <span class="gem"><span class="gem-num">{{ task.importance }}</span></span>
    <div class="body">
      <div class="title">{{ task.title }}</div>
      <div v-if="task.due || task.description" class="meta">
        <span v-if="task.due" class="due">{{ formatDate(task.due) }}</span>
        <span v-if="task.description" class="desc">{{ task.description }}</span>
      </div>
    </div>
    <button class="remove" @click="emit('remove')" title="删除">✕</button>
  </div>
</template>

<style scoped>
.task-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem 0.9rem;
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow);
  margin-bottom: 0.5rem;
  transition: transform 0.15s ease, opacity 0.2s ease, box-shadow 0.2s ease;
}
.task-item:hover {
  transform: translateY(-1px);
}
.task-item.done {
  opacity: 0.42;
}
.task-item.done .title {
  text-decoration: line-through;
}

.check {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: none;
  color: #fff;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
}
.task-item.done .check {
  background: var(--accent);
  border-color: var(--accent);
}

.gem {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  transform: rotate(45deg);
  background: var(--gem, #999);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: inset -2px -2px 3px rgba(0, 0, 0, 0.16), inset 2px 2px 3px rgba(255, 255, 255, 0.28);
}
.gem-num {
  transform: rotate(-45deg);
  font-size: 0.66rem;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

/* 重要度 → 形状/颜色/大小/装饰 */
.imp-5 .gem {
  --gem: var(--imp5);
  width: 26px;
  height: 26px;
}
.imp-4 .gem {
  --gem: var(--imp4);
  width: 23px;
  height: 23px;
}
.imp-3 .gem {
  --gem: #d9a52b;
}
.imp-2 .gem {
  --gem: #55a89f;
  width: 19px;
  height: 19px;
}
.imp-1 .gem {
  --gem: var(--text-3);
  width: 17px;
  height: 17px;
}

.imp-5 {
  border: 1px solid rgba(217, 80, 80, 0.35);
  box-shadow: 0 0 0 3px rgba(217, 80, 80, 0.12), var(--shadow);
}
.imp-5 .title {
  font-weight: 700;
  font-size: 1.06rem;
}
.imp-4 .title {
  font-weight: 650;
}
.imp-2 .title {
  font-weight: 400;
  color: var(--text-2);
}
.imp-1 .title {
  font-weight: 400;
  color: var(--text-3);
}

.body {
  flex: 1;
  min-width: 0;
}
.title {
  font-weight: 550;
}
.meta {
  font-size: 0.8rem;
  color: var(--text-2);
  margin-top: 0.15rem;
  display: flex;
  gap: 0.75rem;
}
.remove {
  background: none;
  border: none;
  color: var(--text-3);
  cursor: pointer;
  font-size: 0.9rem;
}
.remove:hover {
  color: var(--danger);
}
</style>
