<script setup lang="ts">
import { ref, onMounted } from 'vue'
import TasksView from './views/TasksView.vue'
import CalendarView from './views/CalendarView.vue'
import NotesView from './views/NotesView.vue'
import JournalView from './views/JournalView.vue'
import SeasonsView from './views/SeasonsView.vue'
import SettingsView from './views/SettingsView.vue'
import PlansView from './views/PlansView.vue'
import { useTasksStore } from './stores/tasks'

type View = 'tasks' | 'calendar' | 'notes' | 'journal' | 'plans' | 'seasons' | 'settings'
const active = ref<View>('tasks')
const tasksStore = useTasksStore()

onMounted(async () => {
  await tasksStore.load()
})
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-logo">⚔️</span>
        <h1>LifeQuest</h1>
      </div>
      <nav>
        <button :class="{ active: active === 'tasks' }" @click="active = 'tasks'">📋 任务</button>
        <button :class="{ active: active === 'calendar' }" @click="active = 'calendar'">📅 日历</button>
        <button :class="{ active: active === 'notes' }" @click="active = 'notes'">📝 笔记</button>
        <button :class="{ active: active === 'journal' }" @click="active = 'journal'">🌙 日记</button>
        <button :class="{ active: active === 'plans' }" @click="active = 'plans'">🗂 计划</button>
        <button :class="{ active: active === 'seasons' }" @click="active = 'seasons'">🏆 赛季</button>
        <button :class="{ active: active === 'settings' }" @click="active = 'settings'">⚙️ 设置</button>
      </nav>
    </aside>
    <main class="content">
      <TasksView v-if="active === 'tasks'" />
      <CalendarView v-else-if="active === 'calendar'" />
      <NotesView v-else-if="active === 'notes'" />
      <JournalView v-else-if="active === 'journal'" />
      <PlansView v-else-if="active === 'plans'" />
      <SeasonsView v-else-if="active === 'seasons'" />
      <SettingsView v-else />
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100vh;
}
.sidebar {
  width: 200px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #eee;
  padding: 1.25rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.5rem;
}
.brand h1 {
  font-size: 1.1rem;
  margin: 0;
}
.brand-logo {
  font-size: 1.4rem;
}
nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
nav button {
  text-align: left;
  padding: 0.6rem 0.75rem;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  color: #555;
}
nav button.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}
nav button:disabled {
  color: #ccc;
  cursor: default;
}
.content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
}
</style>
