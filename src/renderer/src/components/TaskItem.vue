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
    <button class="check" @click="emit('toggle')">{{ done ? '✅' : '⬜' }}</button>
    <div class="body">
      <div class="title">{{ task.title }}</div>
      <div v-if="task.due || task.description" class="meta">
        <span v-if="task.due" class="due">📅 {{ formatDate(task.due) }}</span>
        <span v-if="task.description" class="desc">{{ task.description }}</span>
      </div>
    </div>
    <div class="imp" :title="`重要度 ${task.importance}/5`">{{ '★'.repeat(task.importance) }}</div>
    <button class="remove" @click="emit('remove')" title="删除">✕</button>
  </div>
</template>

<style scoped>
.task-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 1rem;
  border-radius: 10px;
  background: #fff;
  margin-bottom: 0.5rem;
  transition:
    transform 0.15s ease,
    opacity 0.2s ease;
}
.task-item:hover {
  transform: translateY(-1px);
}
.task-item.done {
  opacity: 0.45;
}
.task-item.done .title {
  text-decoration: line-through;
}
.task-item.imp-5 {
  border-left: 4px solid var(--imp5);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}
.task-item.imp-4 {
  border-left: 4px solid var(--imp4);
}
.task-item.imp-2 {
  opacity: 0.82;
}
.task-item.imp-1 {
  opacity: 0.6;
}
.check {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0;
}
.task-item.done .check {
  animation: pop 0.3s ease;
}
@keyframes pop {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.4);
  }
  100% {
    transform: scale(1);
  }
}
.body {
  flex: 1;
  min-width: 0;
}
.title {
  font-weight: 600;
}
.meta {
  font-size: 0.8rem;
  color: #888;
  margin-top: 0.2rem;
  display: flex;
  gap: 0.75rem;
}
.imp {
  color: #f59e0b;
  letter-spacing: 1px;
  font-size: 0.85rem;
}
.remove {
  background: none;
  border: none;
  color: #ccc;
  cursor: pointer;
}
.remove:hover {
  color: #ef4444;
}
</style>
