<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTasksStore } from '../stores/tasks'
import { toDateStr } from '../utils/helpers'

const store = useTasksStore()
const cursor = ref(new Date())

const year = computed(() => cursor.value.getFullYear())
const month = computed(() => cursor.value.getMonth())

const cells = computed(() => {
  const first = new Date(year.value, month.value, 1)
  const startWeekday = first.getDay()
  const daysInMonth = new Date(year.value, month.value + 1, 0).getDate()
  const list: Array<{ date: string; day: number; inMonth: boolean }> = []
  for (let i = 0; i < startWeekday; i++) {
    list.push({ date: '', day: 0, inMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    list.push({ date: toDateStr(new Date(year.value, month.value, d)), day: d, inMonth: true })
  }
  return list
})

const today = toDateStr(new Date())

function prev(): void {
  cursor.value = new Date(year.value, month.value - 1, 1)
}
function next(): void {
  cursor.value = new Date(year.value, month.value + 1, 1)
}
</script>

<template>
  <div class="calendar-view">
    <header class="view-head">
      <h2>日历</h2>
      <div class="nav">
        <button @click="prev">‹</button>
        <span class="label">{{ year }}年{{ month + 1 }}月</span>
        <button @click="next">›</button>
      </div>
    </header>

    <div class="weekdays">
      <span v-for="w in ['日', '一', '二', '三', '四', '五', '六']" :key="w">{{ w }}</span>
    </div>
    <div class="grid">
      <div
        v-for="(c, i) in cells"
        :key="i"
        class="cell"
        :class="{ empty: !c.inMonth, today: c.date === today }"
      >
        <span class="day">{{ c.day || '' }}</span>
        <div v-if="c.inMonth" class="tasks">
          <div v-for="t in store.tasksOnDate(c.date)" :key="t.id" class="dot" :title="t.title">
            {{ t.title }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.nav button {
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.nav .label {
  font-family: var(--font-display);
  font-weight: 600;
}
.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  margin-bottom: 6px;
  text-align: center;
  color: var(--text-2);
  font-size: 0.8rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.cell {
  min-height: 92px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 6px;
  overflow: hidden;
}
.cell.empty {
  background: transparent;
  border-color: transparent;
}
.cell.today {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.day {
  font-size: 0.8rem;
  color: var(--text-2);
}
.tasks {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dot {
  font-size: 0.72rem;
  background: var(--accent-soft);
  color: var(--accent-text);
  border-radius: 4px;
  padding: 1px 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
