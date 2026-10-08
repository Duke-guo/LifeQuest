<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTasksStore } from '../stores/tasks'
import { useSeasonsStore } from '../stores/seasons'
import type { TaskType } from '../../../shared/types'

const store = useTasksStore()
const seasonsStore = useSeasonsStore()
const title = ref('')
const type = ref<TaskType>('daily')
const importance = ref(3)
const due = ref('')
const seasonId = ref('')

onMounted(async () => {
  await seasonsStore.load()
})

async function submit(): Promise<void> {
  const t = title.value.trim()
  if (!t) return
  await store.addTask({
    title: t,
    type: type.value,
    importance: importance.value,
    due: due.value || null,
    seasonId: seasonId.value || null
  })
  title.value = ''
  due.value = ''
}
</script>

<template>
  <form class="task-form" @submit.prevent="submit">
    <input v-model="title" class="title-input" placeholder="新增任务，回车确认…" />
    <select v-model="type">
      <option value="main">主线</option>
      <option value="side">支线</option>
      <option value="daily">每日</option>
    </select>
    <select v-model="importance">
      <option :value="5">重要 ★5</option>
      <option :value="4">重要 ★4</option>
      <option :value="3">一般 ★3</option>
      <option :value="2">次要 ★2</option>
      <option :value="1">低 ★1</option>
    </select>
    <select v-model="seasonId">
      <option value="">无赛季</option>
      <option v-for="s in seasonsStore.seasons" :key="s.id" :value="s.id">{{ s.name }}</option>
    </select>
    <input v-model="due" type="date" title="截止日期" />
    <button type="submit" class="add-btn">添加</button>
  </form>
</template>

<style scoped>
.task-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}
.title-input {
  flex: 1;
  min-width: 200px;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
select,
input[type='date'] {
  padding: 0.5rem 0.6rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}
.add-btn {
  padding: 0.5rem 1rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}
</style>
