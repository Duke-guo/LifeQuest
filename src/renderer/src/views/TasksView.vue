<script setup lang="ts">
import { useTasksStore } from '../stores/tasks'
import TaskForm from '../components/TaskForm.vue'
import TaskItem from '../components/TaskItem.vue'
import type { TaskType } from '../../../shared/types'

const store = useTasksStore()

const sections: Array<{ type: TaskType; label: string; icon: string }> = [
  { type: 'main', label: '主线任务', icon: 'tasks' },
  { type: 'side', label: '支线任务', icon: 'plans' },
  { type: 'daily', label: '每日任务', icon: 'calendar' }
]
</script>

<template>
  <div class="tasks-view">
    <header class="view-head">
      <div>
        <h2>任务</h2>
        <p class="sub">重要度越高，宝石越醒目</p>
      </div>
    </header>

    <TaskForm />

    <section v-for="s in sections" :key="s.type" class="task-section">
      <h3>{{ s.label }}</h3>
      <div v-if="store.byType(s.type).length === 0" class="empty">暂无任务</div>
      <TaskItem
        v-for="t in store.byType(s.type)"
        :key="t.id"
        :task="t"
        @toggle="store.setStatus(t.id, t.status === 'done' ? 'todo' : 'done')"
        @remove="store.removeTask(t.id)"
      />
    </section>
  </div>
</template>

<style scoped>
.task-section {
  margin-bottom: 1.5rem;
}
.task-section h3 {
  font-size: 1rem;
  color: var(--text-2);
  margin-bottom: 0.6rem;
}
</style>
