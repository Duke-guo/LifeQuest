<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWeeklyJournalStore } from '../stores/weeklyJournal'
import { useConfirmStore } from '../stores/confirm'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ weekStart: string; weekEnd: string; label: string }>()
const emit = defineEmits<{ close: [] }>()

const weekly = useWeeklyJournalStore()
const confirm = useConfirmStore()
const text = ref('')
const saved = ref('')

onMounted(async () => {
  if (!weekly.loaded) await weekly.load()
  text.value = weekly.of(props.weekStart)
})

async function save(): Promise<void> {
  await weekly.save(props.weekStart, text.value)
  saved.value = '已保存'
  window.setTimeout(() => (saved.value = ''), 1800)
}

async function removeEntry(): Promise<void> {
  const ok = await confirm.ask({
    title: '删除这周的周记？',
    message: props.label,
    detail: '文件会从 journal/ 里删掉，无法恢复。',
    confirmText: '删除周记'
  })
  if (!ok) return
  await weekly.remove(props.weekStart)
  text.value = ''
  emit('close')
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="wj-card">
      <button class="close" @click="emit('close')"><AppIcon name="close" :size="20" /></button>
      <header>
        <h2>周记 · {{ label }}</h2>
        <p class="sub">{{ weekStart }} ~ {{ weekEnd }} · 和日记放在同一个文件夹（journal/）</p>
      </header>

      <textarea
        v-model="text"
        class="wj-input"
        rows="12"
        placeholder="这一周做了什么、有什么值得记住的…"
      ></textarea>

      <div class="wj-actions">
        <button v-if="weekly.has(weekStart)" class="ghost" @click="removeEntry">删除</button>
        <span v-if="saved" class="saved">{{ saved }}</span>
        <button class="primary" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 320;
  background: rgba(20, 14, 13, 0.45);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}
.wj-card {
  position: relative;
  width: min(620px, 100%);
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: 18px;
  padding: 1.2rem 1.3rem 1.1rem;
  box-shadow: var(--shadow-lg);
}
.close {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  border: none;
  background: none;
  color: var(--text-3);
  cursor: pointer;
}
.close:hover {
  color: var(--accent);
}
h2 {
  margin: 0 0 0.2rem;
  font-family: var(--font-display);
  font-size: 1.2rem;
}
.sub {
  margin: 0 0 0.8rem;
  font-size: 0.78rem;
  color: var(--text-3);
}
.wj-input {
  width: 100%;
  padding: 0.8rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  line-height: 1.7;
  resize: vertical;
}
.wj-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 0.9rem;
}
.ghost {
  margin-right: auto;
  border: 1px solid var(--danger);
  background: none;
  color: var(--danger);
  border-radius: 10px;
  padding: 0.35rem 0.8rem;
  font-size: 0.85rem;
  cursor: pointer;
}
.primary {
  border: 2px solid var(--accent);
  background: var(--accent);
  color: #fff;
  border-radius: 12px;
  padding: 0.35rem 1.1rem;
  font-family: var(--font-display);
  cursor: pointer;
  box-shadow: 0 3px 0 var(--accent-soft);
}
.saved {
  color: var(--success);
  font-size: 0.85rem;
}
</style>
