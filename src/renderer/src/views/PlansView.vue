<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePlansStore } from '../stores/plans'

const store = usePlansStore()
const title = ref('')
const start = ref('')
const end = ref('')
const notes = ref('')

onMounted(async () => {
  await store.load()
})

async function create(): Promise<void> {
  const t = title.value.trim()
  if (!t) return
  await store.create({ title: t, start: start.value, end: end.value, notes: notes.value })
  title.value = ''
  start.value = ''
  end.value = ''
  notes.value = ''
}
</script>

<template>
  <div class="plans-view">
    <header class="view-head">
      <div>
        <h2>活动计划</h2>
        <p class="sub">会议、活动、安排</p>
      </div>
    </header>

    <section class="create card">
      <div class="form-row">
        <input v-model="title" placeholder="计划 / 活动名（如：社团例会）" />
        <input v-model="start" type="date" />
        <span>~</span>
        <input v-model="end" type="date" />
        <button class="add-btn" @click="create">添加</button>
      </div>
      <input v-model="notes" class="notes-input" placeholder="备注（可选）" />
    </section>

    <section>
      <div v-for="p in store.plans" :key="p.id" class="plan-row card">
        <div>
          <div class="plan-title">🗓 {{ p.title }}</div>
          <div v-if="p.start || p.end" class="plan-meta">{{ p.start || '…' }} ~ {{ p.end || '…' }}</div>
          <div v-if="p.notes" class="plan-notes">{{ p.notes }}</div>
        </div>
        <button class="del" @click="store.remove(p.id)">✕</button>
      </div>
      <div v-if="store.plans.length === 0" class="empty">还没有活动计划</div>
    </section>
  </div>
</template>

<style scoped>
.form-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}
.form-row input {
  padding: 0.5rem 0.6rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.form-row input[placeholder] {
  flex: 1;
  min-width: 200px;
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
.notes-input {
  width: 100%;
  margin-top: 0.6rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.plan-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.plan-title {
  font-weight: 600;
}
.plan-meta {
  font-size: 0.85rem;
  color: #888;
  margin-top: 0.2rem;
}
.plan-notes {
  font-size: 0.85rem;
  color: #666;
  margin-top: 0.2rem;
}
.del {
  border: none;
  background: none;
  color: #ccc;
  cursor: pointer;
}
.del:hover {
  color: #ef4444;
}
</style>
