<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useJournalStore } from '../stores/journal'
import { toDateStr } from '../utils/helpers'

const store = useJournalStore()

onMounted(async () => {
  await store.load(toDateStr(new Date()))
})

async function shift(days: number): Promise<void> {
  const [y, m, d] = store.date.split('-').map(Number)
  const nd = new Date(y, m - 1, d + days)
  await store.load(toDateStr(nd))
}

function isToday(): boolean {
  return store.date === toDateStr(new Date())
}
</script>

<template>
  <div class="journal-view">
    <header class="view-head">
      <div>
        <h2>日记 / 复盘</h2>
        <p class="sub">睡前写几句，给今天收个尾</p>
      </div>
      <div class="date-nav">
        <button @click="shift(-1)">‹</button>
        <span class="date">{{ store.date }}<template v-if="isToday()">（今天）</template></span>
        <button @click="shift(1)">›</button>
        <button v-if="!isToday()" class="today-btn" @click="store.load(toDateStr(new Date()))">回今天</button>
      </div>
    </header>

    <textarea
      v-model="store.content"
      class="journal-editor"
      placeholder="今天发生了什么？完成了什么？有什么想记下的…"
    ></textarea>
    <div class="actions">
      <button class="save-btn" @click="store.save()">保存</button>
    </div>
  </div>
</template>

<style scoped>
.date-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.date-nav button {
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
}
.date-nav .today-btn {
  width: auto;
  padding: 0 0.7rem;
}
.date {
  font-weight: 600;
  min-width: 130px;
  text-align: center;
}
.journal-editor {
  width: 100%;
  min-height: 60vh;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  line-height: 1.7;
  resize: vertical;
}
.actions {
  margin-top: 1rem;
}
.save-btn {
  padding: 0.55rem 1.5rem;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
}
</style>
